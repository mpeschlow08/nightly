import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendanceForecast } from "@/lib/venue-intelligence/attendance";
import { buildInventoryForecast } from "@/lib/venue-intelligence/inventory";
import { buildMarketingRecommendations, createCampaignDraftFromRecommendation } from "@/lib/venue-intelligence/marketing";
import { answerBusinessQuestion } from "@/lib/venue-intelligence/providers/provider-factory";
import { buildRevenueForecast } from "@/lib/venue-intelligence/revenue";
import { parseAskBusinessInput } from "@/lib/venue-intelligence/schemas";
import { buildStaffingRecommendation } from "@/lib/venue-intelligence/staffing";
import type { IntelligenceOverview, Provenance } from "@/lib/venue-intelligence/types";

const now = new Date("2026-01-01T22:00:00.000Z");

function provenance(): Provenance {
  return {
    sourceType: "derived",
    sourceTables: ["events"],
    sourceWindowStart: null,
    sourceWindowEnd: null,
    generatedAt: now.toISOString(),
    lastDataAt: now.toISOString(),
    sampleSize: 5,
    confidenceLevel: "medium",
    confidenceScore: 0.62,
    status: "available",
    limitations: [],
    isEstimated: true,
    isPartial: false,
    providerUsed: "deterministic",
    modelVersion: "deterministic-v1",
  };
}

function overviewFixture(): IntelligenceOverview {
  return {
    scorecard: {
      scoreVersion: "v1",
      compositeScore: 72,
      status: "available",
      components: [],
      weights: {},
    },
    attendanceForecast: {
      expected: 320,
      low: 270,
      high: 370,
      status: "available",
      confidenceLevel: "medium",
      confidenceScore: 0.61,
      keySignals: ["Tickets sold: 210"],
      limitations: [],
      provenance: provenance(),
    },
    revenueForecast: {
      confirmedGrossCents: 200000,
      confirmedNetCents: 170000,
      pendingRevenueCents: 30000,
      estimatedGrossCents: 45000,
      estimatedNetCents: 41400,
      refundedCents: 10000,
      lowNetCents: 180000,
      highNetCents: 235000,
      revenuePerAttendeeCents: 661,
      status: "available",
      confidenceLevel: "medium",
      confidenceScore: 0.58,
      assumptions: [],
      exclusions: [],
      provenance: provenance(),
    },
    staffingRecommendation: {
      doorStaff: 2,
      security: 3,
      bartenders: 4,
      servers: 2,
      vipHosts: 1,
      floorManagers: 1,
      checkinStations: 2,
      backupStaff: 1,
      shiftWindows: [{ label: "Peak", startIso: "+1h", endIso: "+4h" }],
      status: "available",
      confidenceLevel: "medium",
      rationale: ["Advisory only"],
      provenance: provenance(),
    },
    inventoryRisks: [
      {
        itemId: 1,
        itemName: "Vodka",
        expectedConsumption: 18,
        recommendedAvailable: 36,
        reorderQuantity: 12,
        shortageRisk: 0.7,
        overstockRisk: 0.1,
        status: "estimated",
        assumptions: [],
        provenance: provenance(),
      },
    ],
    eventHealth: [],
    customerSegments: [],
    marketingRecommendations: [],
    anomalies: [],
    promoterInsights: [],
    pricingRecommendations: [],
    generatedAt: now.toISOString(),
  };
}

test("attendance forecast returns estimated status with low sample data", () => {
  const result = buildAttendanceForecast({
    eventId: 11,
    venueCapacity: 500,
    historicalAttendance: [200],
    ticketsSold: 180,
    guestListApproved: 70,
    guestListShowRate: 0.7,
    rsvpCount: 90,
    vipReservations: 12,
    tableReservations: 6,
    discoverySaves: 120,
    discoveryShares: 35,
    conciergeReferrals: 20,
    lastDataAt: now,
  });

  assert.equal(result.status, "estimated");
  assert.ok(result.expected > 0);
  assert.ok(result.high >= result.low);
});

test("revenue forecast computes confirmed and estimated net values", () => {
  const result = buildRevenueForecast({
    eventId: 15,
    confirmedTicketGrossCents: 220000,
    confirmedBookingGrossCents: 0,
    confirmedVipGrossCents: 80000,
    confirmedTableGrossCents: 20000,
    pendingTicketCents: 30000,
    estimatedBottleCents: 25000,
    refundsCents: 10000,
    platformFeesCents: 18000,
    promoterCommissionCents: 9000,
    estimatedAttendance: 380,
    sampleSize: 7,
    lastDataAt: now,
  });

  assert.equal(result.confirmedNetCents, 283000);
  assert.equal(result.estimatedNetCents, 50600);
  assert.equal(result.lowNetCents <= result.highNetCents, true);
});

test("staffing recommendation scales with attendance and capacity", () => {
  const result = buildStaffingRecommendation({
    forecastAttendance: 520,
    venueCapacity: 600,
    vipReservations: 30,
    tableReservations: 18,
    incidentRate: 0.1,
    certifiedSecurityCount: 8,
    lastDataAt: now,
  });

  assert.ok(result.security >= 4);
  assert.ok(result.floorManagers >= 1);
  assert.equal(result.status, "available");
});

test("inventory forecast marks shortage risk when on-hand is below threshold", () => {
  const result = buildInventoryForecast({
    forecastAttendance: 320,
    tableReservations: 12,
    vipReservations: 10,
    lastDataAt: now,
    items: [
      {
        itemId: 2,
        itemName: "Tequila",
        onHand: 3,
        par: 16,
        recentConsumption: 14,
        reorderThreshold: 6,
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.ok(result[0].shortageRisk >= 0.65);
  assert.ok(result[0].reorderQuantity > 0);
});

test("marketing recommendations include slow-sell, lapsed, and vip opportunities", () => {
  const result = buildMarketingRecommendations({
    slowSellingEvents: [
      { eventId: 1, eventName: "Basement House", sellThroughPercent: 32 },
      { eventId: 2, eventName: "Indie Night", sellThroughPercent: 48 },
    ],
    lapsedAudienceSize: 11,
    vipUnsold: 4,
    lastDataAt: now,
  });

  assert.ok(result.length >= 4);
  assert.ok(result.some((item) => item.channel === "email"));
  assert.ok(result.some((item) => item.channel === "in_app"));
});

test("campaign draft generation carries recommendation intent", () => {
  const [rec] = buildMarketingRecommendations({
    slowSellingEvents: [{ eventId: 3, eventName: "Neon Friday", sellThroughPercent: 28 }],
    lapsedAudienceSize: 0,
    vipUnsold: 0,
    lastDataAt: now,
  });

  const draft = createCampaignDraftFromRecommendation(rec);
  assert.ok(draft.subject.length > 0);
  assert.ok(draft.preview.includes(rec.title));
});

test("ask business parser enforces required question", () => {
  const ok = new FormData();
  ok.set("question", "What should we optimize tonight?");
  ok.set("conversationId", "42");

  const parsed = parseAskBusinessInput(ok);
  assert.equal(parsed.conversationId, 42);

  const bad = new FormData();
  bad.set("question", " ");
  assert.throws(() => parseAskBusinessInput(bad), /Question is required/);
});

test("provider factory defaults to deterministic answer without ai config", async () => {
  delete process.env.VENUE_INTELLIGENCE_AI_PROVIDER;
  delete process.env.VENUE_INTELLIGENCE_AI_KEY;

  const answer = await answerBusinessQuestion({
    question: "inventory risk tonight",
    overview: overviewFixture(),
  });

  assert.ok(answer.answer.toLowerCase().includes("inventory"));
  assert.equal(answer.provenance.providerUsed, "deterministic");
});
