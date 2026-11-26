/**
 * Client-side rate limiting, cooldowns, and in-flight request coalescing.
 *
 * Keeps Supabase server load minimal by:
 * 1. Deduplicating concurrent identical fetches (e.g. multiple hooks mounting together).
 * 2. Enforcing per-resource fetch cooldowns across tab navigations.
 * 3. Rate-limiting OTP requests and write mutations against accidental bursts.
 */

export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Bounded sliding-window rate limiter safe for long-lived client sessions.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxKeys: number;

  constructor(maxKeys = 256) {
    this.maxKeys = maxKeys;
  }

  consume(
    key: string,
    maxRequests: number,
    windowMs: number,
    now = Date.now()
  ): RateLimitResult {
    const cutoff = now - windowMs;
    const existing = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (existing.length >= maxRequests) {
      const oldest = existing[0] ?? now;
      const retryAfterMs = Math.max(1, oldest + windowMs - now);
      this.hits.set(key, existing);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    existing.push(now);

    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      const oldestKey = this.hits.keys().next().value;
      if (oldestKey !== undefined) this.hits.delete(oldestKey);
    }
    this.hits.set(key, existing);

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - existing.length),
      retryAfterMs: 0,
    };
  }

  peekRetryAfterMs(key: string, maxRequests: number, windowMs: number, now = Date.now()): number {
    const cutoff = now - windowMs;
    const existing = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (existing.length < maxRequests) return 0;
    const oldest = existing[0] ?? now;
    return Math.max(1, oldest + windowMs - now);
  }

  clear(key?: string): void {
    if (key !== undefined) {
      this.hits.delete(key);
    } else {
      this.hits.clear();
    }
  }
}

// ─── Shared application limiters ──────────────────────────────────────────────

export const AUTH_OTP_COOLDOWN_MS = 60_000; // 1 request per 60s per email
export const AUTH_OTP_WINDOW_MS = 5 * 60_000; // max 3 requests per 5 min per email
export const AUTH_OTP_MAX_PER_WINDOW = 3;

export const MUTATION_WINDOW_MS = 10_000; // 10 seconds
export const MUTATION_MAX_PER_WINDOW = 15;

export const authOtpLimiter = new SlidingWindowLimiter(64);
export const mutationLimiter = new SlidingWindowLimiter(64);

/**
 * Enforce magic-link OTP rate limit (60s cooldown + 3/5min cap) before hitting Supabase Auth.
 */
export function assertOtpAllowed(email: string, now = Date.now()): void {
  const normalized = email.trim().toLowerCase();
  const cooldown = authOtpLimiter.consume(`otp-cooldown:${normalized}`, 1, AUTH_OTP_COOLDOWN_MS, now);
  if (!cooldown.allowed) {
    const secs = Math.ceil(cooldown.retryAfterMs / 1000);
    throw new RateLimitError(
      `Please wait ${secs}s before requesting another magic link.`,
      cooldown.retryAfterMs
    );
  }

  const burst = authOtpLimiter.consume(
    `otp-window:${normalized}`,
    AUTH_OTP_MAX_PER_WINDOW,
    AUTH_OTP_WINDOW_MS,
    now
  );
  if (!burst.allowed) {
    const secs = Math.ceil(burst.retryAfterMs / 1000);
    throw new RateLimitError(
      `Too many sign-in attempts. Try again in ${secs}s.`,
      burst.retryAfterMs
    );
  }
}

/**
 * Enforce burst protection on client write mutations.
 */
export function assertMutationAllowed(scope: string, now = Date.now()): void {
  const res = mutationLimiter.consume(scope, MUTATION_MAX_PER_WINDOW, MUTATION_WINDOW_MS, now);
  if (!res.allowed) {
    const secs = Math.max(1, Math.ceil(res.retryAfterMs / 1000));
    throw new RateLimitError(
      `Too many rapid changes. Please wait ${secs}s.`,
      res.retryAfterMs
    );
  }
}

// ─── In-flight deduplication & fetch cooldown coordinator ─────────────────────

const inFlightRequests = new Map<string, Promise<unknown>>();
const lastFetchedAt = new Map<string, number>();

/**
 * Coalesce concurrent identical async requests into a single network call.
 */
export function dedupeInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => {
    if (inFlightRequests.get(key) === promise) {
      inFlightRequests.delete(key);
    }
  });
  inFlightRequests.set(key, promise);
  return promise;
}

export function shouldRevalidate(key: string, cooldownMs: number, now = Date.now()): boolean {
  const last = lastFetchedAt.get(key);
  if (last === undefined) return true;
  return now - last >= cooldownMs;
}

export function markFetched(key: string, now = Date.now()): void {
  lastFetchedAt.set(key, now);
}

export function resetFetchState(prefix?: string): void {
  if (!prefix) {
    lastFetchedAt.clear();
    inFlightRequests.clear();
    return;
  }
  for (const k of lastFetchedAt.keys()) {
    if (k.startsWith(prefix)) lastFetchedAt.delete(k);
  }
  for (const k of inFlightRequests.keys()) {
    if (k.startsWith(prefix)) inFlightRequests.delete(k);
  }
}
