interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding window rate limiter
 * @param key Unique key (e.g. IP address or route+IP)
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (default 60s)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetMs: record.resetAt - now };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count, resetMs: record.resetAt - now };
}

export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}
