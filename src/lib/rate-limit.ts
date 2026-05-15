const attempts = new Map<string, number[]>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_ATTEMPTS) {
    attempts.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return false;
}

/** Configurable rate limiter for non-login surfaces (e.g. agent API). */
export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const store = new Map<string, number[]>();

  return function check(key: string): boolean {
    const now = Date.now();
    const timestamps = (store.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxAttempts) {
      store.set(key, timestamps);
      return true;
    }

    timestamps.push(now);
    store.set(key, timestamps);
    return false;
  };
}
