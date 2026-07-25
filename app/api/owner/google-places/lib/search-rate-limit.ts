const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

type Bucket = {
  windowStart: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

// Temporary in-memory limiter for development/beta only.
// This is not durable and not distributed, so it is not production-grade.
// Replace this helper with a shared service (for example Upstash Redis,
// Vercel Firewall, or another distributed rate-limit provider) for production.
export function consumeOwnerVenueSearchRateLimit(key: string) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });

    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - existing.windowStart)) / 1000)
    );

    return { allowed: false as const, retryAfterSeconds };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return { allowed: true as const, retryAfterSeconds: 0 };
}
