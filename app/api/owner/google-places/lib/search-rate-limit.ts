import { consumeRateLimit } from "@/lib/platform/rate-limit";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

export function consumeOwnerVenueSearchRateLimit(key: string) {
  return consumeRateLimit({
    key,
    scope: "user",
    route: "owner_google_places_search",
    burstLimit: MAX_REQUESTS_PER_WINDOW,
    sustainedLimit: MAX_REQUESTS_PER_WINDOW,
    windowMs: WINDOW_MS,
    bypassInDevelopment: false,
  });
}
