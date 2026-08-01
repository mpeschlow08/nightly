import { consumeRateLimit, resetRateLimitState } from "@/lib/platform/rate-limit";

export function assertSocialRateLimit(key: string, limit: number, windowMs: number) {
  const result = consumeRateLimit({
    key,
    scope: "user",
    route: "social",
    burstLimit: limit,
    sustainedLimit: limit,
    windowMs,
    bypassInDevelopment: false,
  });

  if (!result.allowed) {
    throw new Error("That action is happening too quickly. Try again in a moment.");
  }
}

export function resetSocialRateLimit(key?: string) {
  resetRateLimitState(key);
}