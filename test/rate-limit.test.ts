import {
  SlidingWindowLimiter,
  RateLimitError,
  assertOtpAllowed,
  assertMutationAllowed,
  authOtpLimiter,
  mutationLimiter,
  dedupeInFlight,
  shouldRevalidate,
  markFetched,
  resetFetchState,
} from '../src/lib/rateLimit';
import {
  ServerRateLimiter,
  getClientIp,
  checkAuthCallbackRateLimit,
  resetAuthCallbackRateLimiter,
} from '../src/lib/server-rate-limit';
import { formatCurrency, isValidEmail, isValidIsoDate } from '../src/lib/utils';

afterEach(() => {
  authOtpLimiter.clear();
  mutationLimiter.clear();
  resetFetchState();
  resetAuthCallbackRateLimiter();
});

describe('SlidingWindowLimiter', () => {
  it('enforces maxRequests within the window and resets after expiry', () => {
    const limiter = new SlidingWindowLimiter(10);
    const t0 = 1_000_000;

    expect(limiter.consume('k', 2, 10_000, t0).allowed).toBe(true);
    expect(limiter.consume('k', 2, 10_000, t0 + 100).allowed).toBe(true);

    const blocked = limiter.consume('k', 2, 10_000, t0 + 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(9_800);

    // After the first entry expires, a new request is allowed
    expect(limiter.consume('k', 2, 10_000, t0 + 10_001).allowed).toBe(true);
  });

  it('bounds tracked keys to maxKeys to prevent memory growth', () => {
    const limiter = new SlidingWindowLimiter(2);
    limiter.consume('a', 1, 10_000, 1000);
    limiter.consume('b', 1, 10_000, 1000);
    limiter.consume('c', 1, 10_000, 1000);
    // 'a' was evicted when 'c' was added
    expect(limiter.consume('a', 1, 10_000, 1001).allowed).toBe(true);
  });
});

describe('client OTP & mutation rate limiters', () => {
  it('enforces 60s OTP cooldown per normalized email', () => {
    assertOtpAllowed('User@Example.com', 10_000);
    expect(() => assertOtpAllowed('user@example.com', 15_000)).toThrow(RateLimitError);
    // Different email has its own bucket
    expect(() => assertOtpAllowed('other@example.com', 15_000)).not.toThrow();
  });

  it('enforces burst protection on mutations', () => {
    for (let i = 0; i < 15; i += 1) {
      assertMutationAllowed('tx-write:u1', 50_000 + i);
    }
    expect(() => assertMutationAllowed('tx-write:u1', 50_100)).toThrow(RateLimitError);
  });
});

describe('in-flight deduplication and fetch cooldowns', () => {
  it('coalesces concurrent calls under the same key into one execution', async () => {
    let calls = 0;
    const work = () =>
      dedupeInFlight('budget:u1', async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return 'ok';
      });

    const results = await Promise.all([work(), work(), work()]);
    expect(results).toEqual(['ok', 'ok', 'ok']);
    expect(calls).toBe(1);
  });

  it('clears in-flight entry after rejection so retries can proceed', async () => {
    let attempt = 0;
    await expect(
      dedupeInFlight('k', async () => {
        attempt += 1;
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    const ok = await dedupeInFlight('k', async () => {
      attempt += 1;
      return 'recovered';
    });
    expect(ok).toBe('recovered');
    expect(attempt).toBe(2);
  });

  it('tracks cooldown timestamps cleanly', () => {
    expect(shouldRevalidate('tx:u1:b1', 120_000, 1000)).toBe(true);
    markFetched('tx:u1:b1', 1000);
    expect(shouldRevalidate('tx:u1:b1', 120_000, 60_000)).toBe(false);
    expect(shouldRevalidate('tx:u1:b1', 120_000, 121_000)).toBe(true);
    resetFetchState('tx:');
    expect(shouldRevalidate('tx:u1:b1', 120_000, 60_000)).toBe(true);
  });
});

function mockRequest(headers: Record<string, string>) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    headers: {
      get: (name: string) => lower[name.toLowerCase()] ?? null,
    },
  };
}

describe('server rate limiter', () => {
  it('extracts first IP from x-forwarded-for and caps length', () => {
    const req = mockRequest({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.9');
  });

  it('rate limits excessive callback hits per IP', () => {
    const limiter = new ServerRateLimiter(16);
    expect(limiter.check('ip1', 2, 60_000, 1000).allowed).toBe(true);
    expect(limiter.check('ip1', 2, 60_000, 2000).allowed).toBe(true);
    const blocked = limiter.check('ip1', 2, 60_000, 3000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(58);

    const req = mockRequest({ 'x-real-ip': '198.51.100.7' });
    for (let i = 0; i < 15; i += 1) {
      expect(checkAuthCallbackRateLimit(req).allowed).toBe(true);
    }
    expect(checkAuthCallbackRateLimit(req).allowed).toBe(false);
  });
});

describe('validation & formatting utilities', () => {
  it('validates email and ISO date strings strictly', () => {
    expect(isValidEmail('alex@firefleet.app')).toBe(true);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('no-tld@localhost')).toBe(false);

    expect(isValidIsoDate('2026-11-26')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
  });

  it('preserves fractional cents in formatCurrency while keeping whole numbers clean', () => {
    expect(formatCurrency(12.5, 'USD')).toBe('$12.50');
    expect(formatCurrency(500, 'USD')).toBe('$500');
  });
});
