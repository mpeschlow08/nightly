import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("live routing links discovery cards to /live/[venue] and venue details", () => {
  const venueCard = readFileSync("components/live/LiveVenueCard.tsx", "utf8");
  const livePage = readFileSync("app/live/[venue]/page.tsx", "utf8");
  const consumerData = readFileSync("lib/consumer/data.ts", "utf8");

  assert.ok(venueCard.includes("href={venue.liveHref}"));
  assert.ok(consumerData.includes("/live/${source.venue.slug.trim()}"));
  assert.ok(livePage.includes("getVenueBySlug"));
  assert.ok(livePage.includes("LiveVenueStreamClient"));
  assert.ok(livePage.includes("/venues/${detail.slug}"));
});
