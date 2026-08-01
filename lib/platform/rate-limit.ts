type RateLimitBucket = {
  count: number;
  windowStart: number;
};

export type RateLimitScope = "user" | "ip" | "venue" | "organization" | "route";

export type RateLimitPolicy = {
  key: string;
  scope: RateLimitScope;
  burstLimit: number;
  sustainedLimit: number;
  windowMs: number;
  route: string;
  bypassInDevelopment?: boolean;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  adapter: "in_memory";
};

const buckets = new Map<string, RateLimitBucket>();

function makeStorageKey(policy: RateLimitPolicy) {
  return `${policy.scope}:${policy.route}:${policy.key}`;
}

function toRetryAfterSeconds(now: number, windowStart: number, windowMs: number) {
  return Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
}

export function consumeRateLimit(policy: RateLimitPolicy): RateLimitResult {
  if (policy.bypassInDevelopment && process.env.NODE_ENV !== "production") {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      adapter: "in_memory",
    };
  }

  const now = Date.now();
  const storageKey = makeStorageKey(policy);
  const bucket = buckets.get(storageKey);

  if (!bucket || now - bucket.windowStart >= policy.windowMs) {
    buckets.set(storageKey, {
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
      adapter: "in_memory",
    };
  }

  // First enforce short-burst constraints.
  if (bucket.count >= policy.burstLimit) {
    return {
      allowed: false,
      retryAfterSeconds: toRetryAfterSeconds(now, bucket.windowStart, policy.windowMs),
      adapter: "in_memory",
    };
  }

  // Sustained limit allows stricter long-window ceilings if configured lower than burst.
  if (bucket.count >= policy.sustainedLimit) {
    return {
      allowed: false,
      retryAfterSeconds: toRetryAfterSeconds(now, bucket.windowStart, policy.windowMs),
      adapter: "in_memory",
    };
  }

  bucket.count += 1;
  buckets.set(storageKey, bucket);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    adapter: "in_memory",
  };
}

export function resetRateLimitState(key?: string) {
  if (key) {
    for (const currentKey of buckets.keys()) {
      if (currentKey.includes(key)) {
        buckets.delete(currentKey);
      }
    }

    return;
  }

  buckets.clear();
}
