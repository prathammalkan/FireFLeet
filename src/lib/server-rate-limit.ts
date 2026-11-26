/**
 * Server-side bounded sliding-window rate limiter for Next.js Route Handlers.
 *
 * Uses an O(1)-bounded Map (evicts oldest key when maxKeys is reached) so
 * abusive traffic with spoofed headers cannot exhaust server memory.
 */

export interface ServerRateLimitOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

export interface ServerRateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

const DEFAULT_MAX_KEYS = 2048;

export class ServerRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxKeys: number;

  constructor(maxKeys = DEFAULT_MAX_KEYS) {
    this.maxKeys = maxKeys;
  }

  check(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now()
  ): ServerRateLimitVerdict {
    const cutoff = now - windowMs;
    const recent = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.buckets.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    recent.push(now);
    if (!this.buckets.has(key) && this.buckets.size >= this.maxKeys) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }
    this.buckets.set(key, recent);

    return {
      allowed: true,
      remaining: Math.max(0, limit - recent.length),
      retryAfterSec: 0,
    };
  }

  clear(): void {
    this.buckets.clear();
  }
}

const globalCallbackLimiter = new ServerRateLimiter(DEFAULT_MAX_KEYS);

export interface RequestWithHeaders {
  headers: { get(name: string): string | null };
}

/**
 * Extract a bounded client IP string from incoming proxy headers.
 */
export function getClientIp(request: RequestWithHeaders): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  return 'unknown';
}

export function checkAuthCallbackRateLimit(
  request: RequestWithHeaders,
  options: ServerRateLimitOptions = { limit: 15, windowMs: 60_000 }
): ServerRateLimitVerdict {
  const ip = getClientIp(request);
  return globalCallbackLimiter.check(`auth-cb:${ip}`, options.limit, options.windowMs);
}

export function resetAuthCallbackRateLimiter(): void {
  globalCallbackLimiter.clear();
}
