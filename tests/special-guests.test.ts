import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSpecialGuestModerationFilter,
  applySpecialGuestAnalyticsEvent,
  deriveSpecialGuestStatus,
  matchesSpecialGuestFilter,
  matchesSpecialGuestSearch,
  normalizeSpecialGuestStatus,
  normalizeSpecialGuestVerificationStatus,
  notificationTypesForSpecialGuestAction,
  toSpecialGuestHighlight,
  toSpecialGuestTypeLabel,
  type SpecialGuestRecord,
} from "@/lib/special-guests/service";

function guestFixture(overrides: Partial<SpecialGuestRecord> = {}): SpecialGuestRecord {
  return {
    id: 1,
    displayName: "Future",
    stageName: "Future",
    guestType: "artist",
    customGuestType: null,
    shortDescription: "Headliner appearance",
    appearanceStartAt: new Date("2026-08-03T23:00:00.000Z"),
    appearanceEndAt: new Date("2026-08-04T02:00:00.000Z"),
    visibilityStartAt: new Date("2026-08-01T00:00:00.000Z"),
    visibilityEndAt: new Date("2026-08-04T03:00:00.000Z"),
    verificationStatus: "verified",
    status: "scheduled",
    isActive: true,
    isArchived: false,
    cancelledAt: null,
    ...overrides,
  };
}

test("creation defaults resolve to scheduled status", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");
  const status = deriveSpecialGuestStatus(
    {
      status: "scheduled",
      isArchived: false,
      isActive: true,
      appearanceStartAt: new Date("2026-08-03T23:00:00.000Z"),
      appearanceEndAt: new Date("2026-08-04T02:00:00.000Z"),
      visibilityStartAt: null,
      visibilityEndAt: null,
      cancelledAt: null,
    },
    now
  );

  assert.equal(status, "scheduled");
});

test("editing a guest during appearance resolves to active", () => {
  const now = new Date("2026-08-03T23:30:00.000Z");
  const status = deriveSpecialGuestStatus(
    {
      status: "scheduled",
      isArchived: false,
      isActive: true,
      appearanceStartAt: new Date("2026-08-03T23:00:00.000Z"),
      appearanceEndAt: new Date("2026-08-04T02:00:00.000Z"),
      visibilityStartAt: null,
      visibilityEndAt: null,
      cancelledAt: null,
    },
    now
  );

  assert.equal(status, "active");
});

test("cancellation always resolves to cancelled", () => {
  const now = new Date("2026-08-03T23:30:00.000Z");
  const status = deriveSpecialGuestStatus(
    {
      status: "cancelled",
      isArchived: false,
      isActive: true,
      appearanceStartAt: new Date("2026-08-03T23:00:00.000Z"),
      appearanceEndAt: new Date("2026-08-04T02:00:00.000Z"),
      visibilityStartAt: null,
      visibilityEndAt: null,
      cancelledAt: new Date("2026-08-03T22:00:00.000Z"),
    },
    now
  );

  assert.equal(status, "cancelled");
});

test("automatic expiration resolves after appearance end", () => {
  const now = new Date("2026-08-04T03:00:00.000Z");
  const status = deriveSpecialGuestStatus(
    {
      status: "active",
      isArchived: false,
      isActive: true,
      appearanceStartAt: new Date("2026-08-03T23:00:00.000Z"),
      appearanceEndAt: new Date("2026-08-04T02:00:00.000Z"),
      visibilityStartAt: null,
      visibilityEndAt: null,
      cancelledAt: null,
    },
    now
  );

  assert.equal(status, "expired");
});

test("venue card highlight picks most important guest and more count", () => {
  const now = new Date("2026-08-03T23:30:00.000Z");
  const highlight = toSpecialGuestHighlight([
    guestFixture(),
    guestFixture({ id: 2, guestType: "celebrity", displayName: "Chris Tucker", stageName: null, shortDescription: "Celebrity appearance" }),
    guestFixture({ id: 3, guestType: "athlete", displayName: "NBA All-Star", stageName: null, shortDescription: "Athlete appearance" }),
  ], now);

  assert.ok(highlight);
  assert.equal(highlight?.primary.id, 2);
  assert.equal(highlight?.additionalCount, 2);
});

test("verification badge is included in highlight for verified guest", () => {
  const now = new Date("2026-08-03T23:30:00.000Z");
  const highlight = toSpecialGuestHighlight([guestFixture({ verificationStatus: "verified" })], now);

  assert.equal(highlight?.primary.verificationBadge, "Verified");
});

test("event and venue search can match guest identity", () => {
  const guest = guestFixture({ displayName: "Metro Boomin", stageName: "Metro" });

  const byName = matchesSpecialGuestSearch("metro", guest, { venueName: "Orbit", eventName: "Late Circuit" });
  const byType = matchesSpecialGuestSearch("artist", guest, { venueName: "Orbit", eventName: "Late Circuit" });
  const byVenue = matchesSpecialGuestSearch("orbit", guest, { venueName: "Orbit", eventName: "Late Circuit" });

  assert.equal(byName, true);
  assert.equal(byType, true);
  assert.equal(byVenue, true);
});

test("special guest filters match category and timing", () => {
  const now = new Date("2026-08-03T23:30:00.000Z");
  const guests = [
    guestFixture({ guestType: "artist" }),
    guestFixture({ id: 2, guestType: "celebrity", displayName: "Celebrity X" }),
  ];

  assert.equal(matchesSpecialGuestFilter("has special guest", guests, now), true);
  assert.equal(matchesSpecialGuestFilter("artists", guests, now), true);
  assert.equal(matchesSpecialGuestFilter("celebrities", guests, now), true);
  assert.equal(matchesSpecialGuestFilter("tonight", guests, now), true);
});

test("notification types include announcement, update, cancellation, and reminders", () => {
  assert.deepEqual(notificationTypesForSpecialGuestAction("created"), ["special_guest_announced", "special_guest_reminder"]);
  assert.deepEqual(notificationTypesForSpecialGuestAction("updated"), ["special_guest_updated", "special_guest_starting_soon", "special_guest_reminder"]);
  assert.deepEqual(notificationTypesForSpecialGuestAction("cancelled"), ["special_guest_cancelled"]);
});

test("analytics counters aggregate views, clicks, conversions, and revenue", () => {
  const baseline = {
    views: 0,
    clicks: 0,
    venueConversions: 0,
    reservationConversions: 0,
    ticketConversions: 0,
    revenueCents: 0,
    popularityScore: 0,
  };

  const withView = applySpecialGuestAnalyticsEvent(baseline, "view");
  const withClick = applySpecialGuestAnalyticsEvent(withView, "click");
  const withVenueConversion = applySpecialGuestAnalyticsEvent(withClick, "venue_conversion");
  const withReservation = applySpecialGuestAnalyticsEvent(withVenueConversion, "reservation_conversion", 15000);
  const withTicket = applySpecialGuestAnalyticsEvent(withReservation, "ticket_conversion", 9000);

  assert.equal(withTicket.views, 1);
  assert.equal(withTicket.clicks, 1);
  assert.equal(withTicket.venueConversions, 1);
  assert.equal(withTicket.reservationConversions, 1);
  assert.equal(withTicket.ticketConversions, 1);
  assert.equal(withTicket.revenueCents, 24000);
  assert.equal(withTicket.popularityScore, 25);
});

test("type label formatting supports custom type values", () => {
  assert.equal(toSpecialGuestTypeLabel("artist", null), "Artist");
  assert.equal(toSpecialGuestTypeLabel("special_appearance", null), "Special Appearance");
  assert.equal(toSpecialGuestTypeLabel("custom", "NBA Player Appearance"), "NBA Player Appearance");
});

test("history-related actions expose explicit notification support", () => {
  assert.deepEqual(notificationTypesForSpecialGuestAction("duplicated"), ["special_guest_announced", "special_guest_reminder"]);
  assert.deepEqual(notificationTypesForSpecialGuestAction("auto_expired"), ["special_guest_expired"]);
});

test("moderation verification status normalizes safely", () => {
  assert.equal(normalizeSpecialGuestVerificationStatus("verified"), "verified");
  assert.equal(normalizeSpecialGuestVerificationStatus("VERIFIED"), "verified");
  assert.equal(normalizeSpecialGuestVerificationStatus("bad-input"), "pending_review");
  assert.equal(normalizeSpecialGuestVerificationStatus("bad-input", "unverified"), "unverified");
});

test("moderation lifecycle status normalizes safely", () => {
  assert.equal(normalizeSpecialGuestStatus("active"), "active");
  assert.equal(normalizeSpecialGuestStatus("ARCHIVED"), "archived");
  assert.equal(normalizeSpecialGuestStatus("invalid-status"), "scheduled");
  assert.equal(normalizeSpecialGuestStatus("invalid-status", "cancelled"), "cancelled");
});

test("admin moderation filter parsing handles typed query params", () => {
  const parsed = buildSpecialGuestModerationFilter({
    verificationStatus: "verified",
    status: "active",
    eventId: "24",
    venueId: "all",
    q: " Metro ",
    from: "2026-08-01",
    to: "2026-08-03",
  });

  assert.equal(parsed.verificationStatus, "verified");
  assert.equal(parsed.status, "active");
  assert.equal(parsed.eventId, 24);
  assert.equal(parsed.venueId, null);
  assert.equal(parsed.query, "Metro");
  assert.equal(parsed.fromDate, "2026-08-01");
  assert.equal(parsed.toDate, "2026-08-03");
});

test("admin moderation filter parsing falls back for malformed params", () => {
  const parsed = buildSpecialGuestModerationFilter({
    verificationStatus: "nonsense",
    status: "nonsense",
    eventId: "x12",
    venueId: "-10",
    q: "",
    from: "08/01/2026",
    to: "2026-8-3",
  });

  assert.equal(parsed.verificationStatus, "pending_review");
  assert.equal(parsed.status, "scheduled");
  assert.equal(parsed.eventId, null);
  assert.equal(parsed.venueId, null);
  assert.equal(parsed.query, "");
  assert.equal(parsed.fromDate, "");
  assert.equal(parsed.toDate, "");
});
