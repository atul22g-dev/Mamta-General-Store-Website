import "server-only";

/**
 * Fixed-window in-memory rate limiter. Adequate for a single-instance
 * deployment; swap for a shared store (e.g. Redis) when scaling horizontally.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Attempt {
  count: number;
  windowStart: number;
}

const globalForLimiter = globalThis as unknown as {
  __mgs_login_attempts?: Map<string, Attempt>;
};

const attempts: Map<string, Attempt> = globalForLimiter.__mgs_login_attempts ?? new Map();
globalForLimiter.__mgs_login_attempts = attempts;

/** Max attempts per key per window. */
export const LOGIN_RATE_LIMIT = MAX_ATTEMPTS;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest attempt leaves the window (when blocked). */
  retryAfterSeconds: number;
}

/**
 * Record an attempt for `key` and report whether it is within the limit.
 * Call before verifying credentials; on failure, call `resetRateLimit`
 * after a successful login so a correct password is never locked out by
 * earlier typos.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  record.count += 1;

  if (record.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clear the record for `key` (used after a successful login). */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
