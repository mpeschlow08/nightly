import assert from "node:assert/strict";
import test from "node:test";

import { ARTIST_SESSION_MAX_DURATION_MS, artistSessionLeaseExpiresAt, canViewOperationalSessions,
  mayAccessArtistSession, sourceRole, withinSessionWindow } from "../lib/artist-sessions/policy";

test("operational session visibility is scoped to owner and delegated Tech Operator venues", () => {
  assert.equal(canViewOperationalSessions({ role: "owner", venueId: 7 }, 7), true);
  assert.equal(canViewOperationalSessions({ role: "owner", venueId: 7 }, 8), false);
  assert.equal(canViewOperationalSessions({ role: "tech_operator", venueId: 7 }, 7), true);
  assert.equal(canViewOperationalSessions({ role: "tech_operator", venueId: 7 }, 8), false);
  assert.equal(canViewOperationalSessions({ role: "unrelated", venueId: null }, 7), false);
  assert.equal(canViewOperationalSessions({ role: "manager", venueId: 7 }, 7), false);
});

test("artist session ownership requires both authenticated user and DJ identity", () => {
  assert.equal(mayAccessArtistSession({ userId: 1, djProfileId: 2 }, { userId: 1, djProfileId: 2 }), true);
  assert.equal(mayAccessArtistSession({ userId: 1, djProfileId: 2 }, { userId: 3, djProfileId: 2 }), false);
  assert.equal(mayAccessArtistSession({ userId: 1, djProfileId: 2 }, { userId: 1, djProfileId: 3 }), false);
});

test("active and historical session windows require matching venue and source timing", () => {
  const session = { venueId: 7, status: "active", startedAt: new Date(1000), endedAt: null };
  assert.equal(withinSessionWindow(session, { venueId: 7, start: new Date(1000), end: new Date(2000) }), true);
  assert.equal(withinSessionWindow(session, { venueId: 8, start: new Date(1000), end: new Date(2000) }), false);
  assert.equal(withinSessionWindow(session, { venueId: 7, start: new Date(999), end: new Date(2000) }), false);
  const ended = { ...session, status: "ended", endedAt: new Date(2500) };
  assert.equal(withinSessionWindow(ended, { venueId: 7, start: new Date(1000), end: new Date(2000) }), true);
  assert.equal(withinSessionWindow(ended, { venueId: 7, start: new Date(2400), end: new Date(2600) }), false);
  assert.equal(withinSessionWindow({ ...ended, endedAt: null }, { venueId: 7, start: new Date(1000), end: new Date(2000) }), false);
  assert.equal(withinSessionWindow(session, { venueId: 7, start: new Date(2000), end: new Date(1000) }), false);
});

test("canonical source types classify camera, program and crowd without inventing new sources", () => {
  assert.equal(sourceRole("ip_camera"), "camera");
  assert.equal(sourceRole("mixer_audio"), "program_audio");
  assert.equal(sourceRole("ambient_audio"), "ambient_audio");
  assert.equal(sourceRole("other"), null);
});

test("artist session lease has a finite absolute deadline", () => {
  const startedAt = new Date(1_000);
  assert.equal(artistSessionLeaseExpiresAt(startedAt)?.getTime(), startedAt.getTime() + ARTIST_SESSION_MAX_DURATION_MS);
  assert.equal(ARTIST_SESSION_MAX_DURATION_MS, 12 * 60 * 60 * 1000);
  assert.equal(artistSessionLeaseExpiresAt(new Date(Number.NaN)), null);
});