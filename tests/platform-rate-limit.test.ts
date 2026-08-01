import assert from "node:assert/strict";
import test from "node:test";

import { consumeRateLimit, resetRateLimitState } from "../lib/platform/rate-limit";

test("rate limiter blocks after burst threshold", () => {
  const key = "test-user";
  resetRateLimitState(key);

  const first = consumeRateLimit({
    key,
    scope: "user",
    route: "test",
    burstLimit: 2,
    sustainedLimit: 2,
    windowMs: 60_000,
  });

  const second = consumeRateLimit({
    key,
    scope: "user",
    route: "test",
    burstLimit: 2,
    sustainedLimit: 2,
    windowMs: 60_000,
  });

  const third = consumeRateLimit({
    key,
    scope: "user",
    route: "test",
    burstLimit: 2,
    sustainedLimit: 2,
    windowMs: 60_000,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSeconds >= 1);
});
