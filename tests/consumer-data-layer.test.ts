import assert from "node:assert/strict";
import test from "node:test";

import { distanceMilesBetween, formatDistanceMiles } from "@/lib/consumer/distance";
import { fixturesEnabled } from "@/lib/consumer/fixtures";
import { getNightWindow, isEventLive, isInTonightWindow } from "@/lib/consumer/time";
import { isEventPublic, isVenuePublic } from "@/lib/consumer/visibility";

type VenueArg = Parameters<typeof isVenuePublic>[0];
type EventArg = Parameters<typeof isEventPublic>[0];

const baseVenue = {
  id: 1,
  name: "Atlas",
  publicationStatus: "published",
  latitude: 33.75,
  longitude: -84.39,
  city: "Atlanta",
  archivedAt: null,
  suspendedAt: null,
} as VenueArg;

test("isVenuePublic requires publication and location readiness", () => {
  assert.equal(isVenuePublic(baseVenue), true);

  const archived = { ...baseVenue, archivedAt: new Date() };
  assert.equal(isVenuePublic(archived as VenueArg), false);

  const missingLocation = {
    ...baseVenue,
    latitude: null,
    longitude: null,
    city: null,
  };
  assert.equal(isVenuePublic(missingLocation as VenueArg), false);
});

test("isEventPublic rejects canceled or stale events", () => {
  const now = new Date("2026-07-30T03:00:00.000Z");

  const event = {
    id: 9,
    isPublished: true,
    publicationStatus: "draft",
    isCanceled: false,
    isArchived: false,
    startsAt: new Date("2026-07-30T01:00:00.000Z"),
    endsAt: new Date("2026-07-30T05:00:00.000Z"),
  } as EventArg;

  assert.equal(isEventPublic(event, baseVenue, now), true);
  assert.equal(isEventPublic({ ...event, isCanceled: true } as EventArg, baseVenue, now), false);

  const stale = {
    ...event,
    startsAt: new Date("2026-07-28T00:00:00.000Z"),
    endsAt: new Date("2026-07-28T01:00:00.000Z"),
  };
  assert.equal(isEventPublic(stale as EventArg, baseVenue, now), false);
});

test("night window spans across midnight cutoff", () => {
  const tz = "America/New_York";
  const beforeCutoff = new Date("2026-07-30T07:30:00.000Z"); // 03:30 local
  const { windowStart, windowEnd } = getNightWindow(beforeCutoff, tz);

  const startsAt = new Date(windowStart.getTime() + 2 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  assert.equal(isInTonightWindow(startsAt, endsAt, beforeCutoff, tz), true);
  assert.equal(isInTonightWindow(new Date(windowEnd.getTime() + 60_000), null, beforeCutoff, tz), false);
});

test("isEventLive uses 3-hour fallback end when missing endsAt", () => {
  const startsAt = new Date("2026-07-30T01:00:00.000Z");
  assert.equal(isEventLive(startsAt, null, new Date("2026-07-30T03:30:00.000Z")), true);
  assert.equal(isEventLive(startsAt, null, new Date("2026-07-30T04:30:01.000Z")), false);
});

test("distance helpers return stable values and null safety", () => {
  assert.equal(distanceMilesBetween(null, { latitude: 1, longitude: 1 }), null);
  assert.equal(formatDistanceMiles(null), null);

  const miles = distanceMilesBetween(
    { latitude: 33.749, longitude: -84.388 },
    { latitude: 33.781, longitude: -84.387 }
  );

  assert.ok(miles != null);
  assert.match(formatDistanceMiles(miles) ?? "", /mi$/);
});

test("fixturesEnabled is false in production unless explicitly enabled", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ENABLE_CONSUMER_FIXTURES;

  mutableEnv.NODE_ENV = "production";
  mutableEnv.ENABLE_CONSUMER_FIXTURES = "false";
  assert.equal(fixturesEnabled(), false);

  mutableEnv.ENABLE_CONSUMER_FIXTURES = "true";
  assert.equal(fixturesEnabled(), true);

  mutableEnv.NODE_ENV = "development";
  delete mutableEnv.ENABLE_CONSUMER_FIXTURES;
  assert.equal(fixturesEnabled(), true);

  mutableEnv.NODE_ENV = originalNodeEnv;
  if (originalFlag === undefined) {
    delete mutableEnv.ENABLE_CONSUMER_FIXTURES;
  } else {
    mutableEnv.ENABLE_CONSUMER_FIXTURES = originalFlag;
  }
});
