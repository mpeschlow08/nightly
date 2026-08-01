import "server-only";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { getCurrentOwnerVenue } from "@/app/owner/lib/ownership";
import { db } from "@/db";
import {
  eventAnalyticsDaily,
  events,
  guestListEntries,
  promoterEventAssignments,
  promoterProfiles,
  ticketOrders,
  ticketProducts,
  ticketRefunds,
  venueAiConversations,
  venueAiMessages,
  venueAnomalies,
  venueCampaignDrafts,
  venueCustomerProfiles,
  venueEventForecasts,
  venueInsightRecommendations,
  venueInsightFeedback,
  venueIntelligenceRuns,
  venueIntelligenceSnapshots,
  venueInventoryForecasts,
  venueInventoryItems,
  venueInventoryMovements,
  venueMarketingRecommendations,
  venuePricingRecommendations,
  venuePromoterInsights,
  venueRevenueForecasts,
  venueStaffCertifications,
  venueVipReservations,
  venues,
} from "@/db/schema";

import { buildAttendanceForecast } from "./attendance";
import { detectAnomalies } from "./anomalies";
import { INTELLIGENCE_ALGORITHM_VERSION, INTELLIGENCE_WEIGHTS } from "./constants";
import { buildCustomerSegments, buildRetentionSignals } from "./customers";
import { buildEventHealthScore } from "./events";
import { buildInventoryForecast } from "./inventory";
import { createCampaignDraftFromRecommendation, buildMarketingRecommendations } from "./marketing";
import { buildPreEventBriefing, buildPostEventRecap } from "./operations";
import { buildPromoterInsights } from "./promoters";
import { buildRevenueForecast } from "./revenue";
import { buildPricingRecommendation } from "./recommendations";
import { buildStaffingRecommendation } from "./staffing";
import { answerBusinessQuestion } from "./providers/provider-factory";
import type { AskBusinessAnswer, IntelligenceMetric, IntelligenceOverview } from "./types";

function scoreMetric(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function getVenueScopeData(venueId: number) {
  const now = new Date();
  const upcomingEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.venueId, venueId), gte(events.startsAt, new Date(now.getTime() - 4 * 60 * 60 * 1000))))
    .orderBy(asc(events.startsAt))
    .limit(16);

  const eventIds = upcomingEvents.map((event) => event.id);
  const [
    products,
    orders,
    refunds,
    guestEntries,
    vipReservations,
    customers,
    inventoryItems,
    inventoryMovements,
    promoterAssignments,
    promoters,
    analyticsDaily,
    certCount,
  ] = await Promise.all([
    eventIds.length > 0 ? db.select().from(ticketProducts).where(inArray(ticketProducts.eventId, eventIds)) : Promise.resolve([]),
    eventIds.length > 0 ? db.select().from(ticketOrders).where(inArray(ticketOrders.eventId, eventIds)) : Promise.resolve([]),
    eventIds.length > 0 ? db.select().from(ticketRefunds).where(inArray(ticketRefunds.eventId, eventIds)) : Promise.resolve([]),
    eventIds.length > 0 ? db.select().from(guestListEntries).where(inArray(guestListEntries.eventId, eventIds)) : Promise.resolve([]),
    db.select().from(venueVipReservations).where(eq(venueVipReservations.venueId, venueId)).limit(120),
    db.select().from(venueCustomerProfiles).where(eq(venueCustomerProfiles.venueId, venueId)).limit(500),
    db.select().from(venueInventoryItems).where(eq(venueInventoryItems.venueId, venueId)).limit(120),
    db.select().from(venueInventoryMovements).where(eq(venueInventoryMovements.venueId, venueId)).orderBy(desc(venueInventoryMovements.createdAt)).limit(500),
    eventIds.length > 0 ? db.select().from(promoterEventAssignments).where(inArray(promoterEventAssignments.eventId, eventIds)) : Promise.resolve([]),
    db.select().from(promoterProfiles).limit(300),
    eventIds.length > 0 ? db.select().from(eventAnalyticsDaily).where(inArray(eventAnalyticsDaily.eventId, eventIds)).orderBy(desc(eventAnalyticsDaily.metricDate)).limit(500) : Promise.resolve([]),
    db.select({ count: sql<number>`count(*)::int` }).from(venueStaffCertifications),
  ]);

  return {
    now,
    upcomingEvents,
    products,
    orders,
    refunds,
    guestEntries,
    vipReservations,
    customers,
    inventoryItems,
    inventoryMovements,
    promoterAssignments,
    promoters,
    analyticsDaily,
    certifiedSecurityCount: certCount[0]?.count ?? 0,
  };
}

function buildScorecardMetrics(input: {
  venue: typeof venues.$inferSelect;
  forecastAttendance: number;
  capacityAnchor: number;
  guestListCheckedIn: number;
  guestListApproved: number;
  ticketSold: number;
  ticketInventory: number;
  vipConfirmed: number;
  vipTotal: number;
  refundRatePercent: number;
  retentionRatePercent: number;
  loyaltyEngagementPercent: number;
  incidentsPerEvent: number;
  inventoryVariancePercent: number;
}): IntelligenceMetric[] {
  const profileFields = [
    Boolean(input.venue.name?.trim()),
    Boolean(input.venue.description?.trim()),
    Boolean(input.venue.address?.trim()),
    Boolean(input.venue.websiteUrl?.trim()),
    input.venue.latitude != null && input.venue.longitude != null,
  ];

  const profileCompleteness = (profileFields.filter(Boolean).length / profileFields.length) * 100;
  const attendanceUtilization = input.capacityAnchor > 0 ? (input.forecastAttendance / input.capacityAnchor) * 100 : 0;
  const ticketConversion = input.ticketInventory > 0 ? (input.ticketSold / input.ticketInventory) * 100 : 0;
  const guestListConversion = input.guestListApproved > 0 ? (input.guestListCheckedIn / input.guestListApproved) * 100 : 0;
  const vipConversion = input.vipTotal > 0 ? (input.vipConfirmed / input.vipTotal) * 100 : 0;

  const metrics: Array<{ key: keyof typeof INTELLIGENCE_WEIGHTS; label: string; value: number; unit: IntelligenceMetric["unit"] }> = [
    { key: "profileCompleteness", label: "Profile completeness", value: profileCompleteness, unit: "percent" },
    { key: "eventPublishing", label: "Event publishing consistency", value: input.forecastAttendance > 0 ? 80 : 55, unit: "percent" },
    { key: "attendanceUtilization", label: "Capacity utilization", value: attendanceUtilization, unit: "percent" },
    { key: "ticketConversion", label: "Ticket conversion", value: ticketConversion, unit: "percent" },
    { key: "guestListConversion", label: "Guest-list conversion", value: guestListConversion, unit: "percent" },
    { key: "vipConversion", label: "VIP conversion", value: vipConversion, unit: "percent" },
    { key: "bookingAcceptance", label: "Booking acceptance", value: 72, unit: "percent" },
    { key: "refundRate", label: "Refund health", value: Math.max(0, 100 - input.refundRatePercent * 2), unit: "percent" },
    { key: "customerRetention", label: "Customer retention", value: input.retentionRatePercent, unit: "percent" },
    { key: "loyaltyEngagement", label: "Loyalty engagement", value: input.loyaltyEngagementPercent, unit: "percent" },
    { key: "incidentRate", label: "Incident health", value: Math.max(0, 100 - input.incidentsPerEvent * 15), unit: "percent" },
    { key: "inventoryVariance", label: "Inventory variance health", value: Math.max(0, 100 - input.inventoryVariancePercent), unit: "percent" },
  ];

  return metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: scoreMetric(metric.value),
    unit: metric.unit,
    trend: "flat",
    trendDelta: 0,
    status: "available",
    provenance: {
      sourceType: "derived",
      sourceTables: ["venues", "events", "ticket_orders", "guest_list_entries", "venue_vip_reservations", "venue_inventory_movements"],
      sourceWindowStart: null,
      sourceWindowEnd: null,
      generatedAt: new Date().toISOString(),
      lastDataAt: new Date().toISOString(),
      sampleSize: null,
      confidenceLevel: "medium",
      confidenceScore: 0.62,
      status: "available",
      limitations: ["Weights are internal and configurable."],
      isEstimated: true,
      isPartial: false,
      providerUsed: "deterministic",
      modelVersion: INTELLIGENCE_ALGORITHM_VERSION,
    },
  }));
}

export async function getOwnerIntelligenceOverview() {
  const membership = await getCurrentOwnerVenue();
  const { venueId, venue } = membership;
  const data = await getVenueScopeData(venueId);

  const primaryEvent = data.upcomingEvents[0] ?? null;
  const primaryEventProducts = primaryEvent ? data.products.filter((product) => product.eventId === primaryEvent.id) : [];
  const primaryEventOrders = primaryEvent ? data.orders.filter((order) => order.eventId === primaryEvent.id) : [];
  const primaryEventRefunds = primaryEvent ? data.refunds.filter((refund) => refund.eventId === primaryEvent.id) : [];
  const primaryGuestListEntries = primaryEvent ? data.guestEntries.filter((entry) => entry.eventId === primaryEvent.id) : [];

  const ticketInventory = primaryEventProducts.reduce((sum, product) => sum + product.quantityTotal, 0);
  const ticketsSold = primaryEventProducts.reduce((sum, product) => sum + product.quantitySold, 0);
  const guestApproved = primaryGuestListEntries.filter((entry) => entry.status === "approved").length;
  const guestCheckedIn = primaryGuestListEntries.reduce((sum, entry) => sum + entry.checkedInCount, 0);
  const vipForEvent = primaryEvent ? data.vipReservations.filter((reservation) => reservation.eventId === primaryEvent.id) : [];

  const attendance = buildAttendanceForecast({
    eventId: primaryEvent?.id ?? 0,
    venueCapacity: Math.max(1, ticketInventory + guestApproved + vipForEvent.length),
    historicalAttendance: data.analyticsDaily.map((metric) => metric.ticketClicks),
    ticketsSold,
    guestListApproved: guestApproved,
    guestListShowRate: 0.68,
    rsvpCount: data.analyticsDaily.reduce((sum, metric) => sum + metric.favorites, 0),
    vipReservations: vipForEvent.length,
    tableReservations: vipForEvent.filter((reservation) => reservation.floorObjectId != null).length,
    discoverySaves: data.analyticsDaily.reduce((sum, metric) => sum + metric.favorites, 0),
    discoveryShares: data.analyticsDaily.reduce((sum, metric) => sum + metric.shares, 0),
    conciergeReferrals: Math.round(data.analyticsDaily.reduce((sum, metric) => sum + metric.views, 0) * 0.05),
    lastDataAt: data.analyticsDaily[0]?.updatedAt ?? primaryEvent?.updatedAt ?? venue.updatedAt,
  });

  const confirmedPaidOrders = primaryEventOrders.filter((order) => order.paymentStatus === "paid" || order.status === "completed");
  const pendingOrders = primaryEventOrders.filter((order) => order.paymentStatus !== "paid" && order.status !== "cancelled");
  const refundsCents = primaryEventRefunds.reduce((sum, refund) => sum + refund.amountCents, 0);

  const revenue = buildRevenueForecast({
    eventId: primaryEvent?.id ?? null,
    confirmedTicketGrossCents: confirmedPaidOrders.reduce((sum, order) => sum + order.totalCents, 0),
    confirmedBookingGrossCents: 0,
    confirmedVipGrossCents: vipForEvent.reduce((sum, vip) => sum + vip.finalSpendCents, 0),
    confirmedTableGrossCents: 0,
    pendingTicketCents: pendingOrders.reduce((sum, order) => sum + order.totalCents, 0),
    estimatedBottleCents: Math.round(vipForEvent.reduce((sum, vip) => sum + vip.minimumSpendCents, 0) * 0.3),
    refundsCents,
    platformFeesCents: Math.round(confirmedPaidOrders.reduce((sum, order) => sum + order.totalCents, 0) * 0.06),
    promoterCommissionCents: 0,
    estimatedAttendance: attendance.expected,
    sampleSize: data.upcomingEvents.length,
    lastDataAt: data.orders[0]?.updatedAt ?? venue.updatedAt,
  });

  const staffing = buildStaffingRecommendation({
    forecastAttendance: attendance.expected,
    venueCapacity: Math.max(1, ticketInventory + guestApproved + vipForEvent.length),
    vipReservations: vipForEvent.length,
    tableReservations: vipForEvent.filter((vip) => vip.floorObjectId != null).length,
    incidentRate: 0,
    certifiedSecurityCount: data.certifiedSecurityCount,
    lastDataAt: venue.updatedAt,
  });

  const movementByItem = new Map<number, number>();
  for (const movement of data.inventoryMovements) {
    const current = movementByItem.get(movement.itemId) ?? 0;
    const adjustment = movement.movementType === "consume" || movement.movementType === "waste" ? Math.abs(movement.quantity) : 0;
    movementByItem.set(movement.itemId, current + adjustment);
  }

  const inventory = buildInventoryForecast({
    forecastAttendance: attendance.expected,
    tableReservations: vipForEvent.filter((vip) => vip.floorObjectId != null).length,
    vipReservations: vipForEvent.length,
    items: data.inventoryItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      onHand: item.onHandQuantity,
      par: item.parQuantity,
      recentConsumption: movementByItem.get(item.id) ?? 0,
      reorderThreshold: item.reorderThreshold,
    })),
    lastDataAt: data.inventoryMovements[0]?.createdAt ?? venue.updatedAt,
  });

  const segments = buildCustomerSegments({
    profiles: data.customers.map((customer) => ({
      id: customer.id,
      visitCount: customer.visitCount,
      vipVisitCount: customer.vipVisitCount,
      lifetimeSpendCents: customer.lifetimeSpendCents,
      loyaltyPoints: customer.loyaltyPoints,
      marketingEligible: customer.marketingEligible,
      lastVisitAt: customer.lastVisitAt,
    })),
    now: data.now,
    lastDataAt: data.customers[0]?.updatedAt ?? venue.updatedAt,
  });

  const retentionCounts = { engaged: 0, atRisk: 0, lapsed: 0, returning: 0, new: 0, vipActive: 0 };
  for (const profile of data.customers) {
    const signal = buildRetentionSignals({
      profile: {
        id: profile.id,
        visitCount: profile.visitCount,
        vipVisitCount: profile.vipVisitCount,
        lifetimeSpendCents: profile.lifetimeSpendCents,
        loyaltyPoints: profile.loyaltyPoints,
        marketingEligible: profile.marketingEligible,
        lastVisitAt: profile.lastVisitAt,
      },
      now: data.now,
    });

    if (signal === "engaged") retentionCounts.engaged += 1;
    if (signal === "at_risk") retentionCounts.atRisk += 1;
    if (signal === "lapsed") retentionCounts.lapsed += 1;
    if (signal === "returning") retentionCounts.returning += 1;
    if (signal === "new") retentionCounts.new += 1;
    if (signal === "vip_active") retentionCounts.vipActive += 1;
  }

  const slowSellingEvents = data.upcomingEvents.map((event) => {
    const eventProducts = data.products.filter((product) => product.eventId === event.id);
    const total = eventProducts.reduce((sum, product) => sum + product.quantityTotal, 0);
    const sold = eventProducts.reduce((sum, product) => sum + product.quantitySold, 0);

    return {
      eventId: event.id,
      eventName: event.title,
      sellThroughPercent: total > 0 ? (sold / total) * 100 : 0,
    };
  }).filter((event) => event.sellThroughPercent < 65);

  const marketingRecommendations = buildMarketingRecommendations({
    slowSellingEvents,
    lapsedAudienceSize: segments.find((segment) => segment.key === "lapsed_guests")?.audienceSize ?? 0,
    vipUnsold: vipForEvent.filter((reservation) => reservation.status === "pending").length,
    lastDataAt: data.analyticsDaily[0]?.updatedAt ?? venue.updatedAt,
  });

  const promoterById = new Map(data.promoters.map((promoter) => [promoter.id, promoter]));
  const promoterSignals = data.promoterAssignments.map((assignment) => {
    const promoter = promoterById.get(assignment.promoterProfileId);
    const tickets = data.orders.filter((order) => order.eventId === assignment.eventId && (order.status === "completed" || order.paymentStatus === "paid"));
    const arrivals = data.guestEntries.filter((entry) => entry.eventId === assignment.eventId).reduce((sum, entry) => sum + entry.checkedInCount, 0);

    return {
      promoterProfileId: assignment.promoterProfileId,
      promoterName: promoter?.displayName ?? `Promoter ${assignment.promoterProfileId}`,
      assignedEvents: 1,
      ticketSales: tickets.length,
      guestListArrivals: arrivals,
      attributedRevenueCents: tickets.reduce((sum, ticket) => sum + ticket.totalCents, 0),
    };
  });

  const promoterInsights = buildPromoterInsights({
    promoters: promoterSignals,
    lastDataAt: data.promoterAssignments[0]?.updatedAt ?? venue.updatedAt,
  });

  const pricingRecommendations = primaryEventProducts.slice(0, 3).map((product) => buildPricingRecommendation({
    productType: product.productType,
    currentPriceCents: product.priceCents,
    sellThroughPercent: product.quantityTotal > 0 ? (product.quantitySold / product.quantityTotal) * 100 : 0,
    daysToEvent: primaryEvent ? Math.max(0, Math.ceil((primaryEvent.startsAt.getTime() - data.now.getTime()) / 86_400_000)) : 3,
    refundRatePercent: ticketsSold > 0 ? (primaryEventRefunds.length / ticketsSold) * 100 : 0,
    lastDataAt: product.updatedAt,
  }));

  const eventHealth = data.upcomingEvents.slice(0, 5).map((event) => {
    const eventProducts = data.products.filter((product) => product.eventId === event.id);
    const eventInventory = eventProducts.reduce((sum, product) => sum + product.quantityTotal, 0);
    const eventSold = eventProducts.reduce((sum, product) => sum + product.quantitySold, 0);
    const eventRefunds = data.refunds.filter((refund) => refund.eventId === event.id);
    const engagement = data.analyticsDaily.filter((metric) => metric.eventId === event.id).reduce((sum, metric) => sum + metric.views + metric.favorites + metric.shares, 0) / 3;
    const promoter = promoterSignals.find((signal) => signal.assignedEvents === 1);

    return buildEventHealthScore({
      eventId: event.id,
      eventName: event.title,
      ticketsSold: eventSold,
      ticketInventory: eventInventory,
      refunds: eventRefunds.length,
      forecastAttendance: attendance.expected,
      capacity: Math.max(1, eventInventory + data.guestEntries.filter((entry) => entry.eventId === event.id && entry.status === "approved").length),
      incidents: 0,
      campaignEngagement: engagement,
      promoterConversionRate: promoter ? promoter.guestListArrivals / Math.max(1, promoter.ticketSales) : 0,
      lastDataAt: event.updatedAt,
    });
  });

  const anomalyHistory = data.analyticsDaily.slice(0, 14).map((metric) => metric.ticketClicks);
  const anomalyActual = anomalyHistory[0] ?? 0;
  const anomalies = detectAnomalies({
    metricKey: "ticket_clicks",
    history: anomalyHistory.slice(1),
    actual: anomalyActual,
    label: "Ticket click velocity",
    lastDataAt: data.analyticsDaily[0]?.updatedAt ?? venue.updatedAt,
  });

  const retentionRatePercent = data.customers.length > 0
    ? ((retentionCounts.engaged + retentionCounts.vipActive + retentionCounts.returning) / data.customers.length) * 100
    : 0;

  const loyaltyEngagementPercent = data.customers.length > 0
    ? (data.customers.filter((customer) => customer.loyaltyPoints > 0).length / data.customers.length) * 100
    : 0;

  const incidentRate = 0;
  const inventoryVariance = inventory.length > 0
    ? average(inventory.map((entry) => Math.abs(entry.expectedConsumption - entry.recommendedAvailable) / Math.max(1, entry.recommendedAvailable) * 100))
    : 0;

  const scorecardComponents = buildScorecardMetrics({
    venue,
    forecastAttendance: attendance.expected,
    capacityAnchor: Math.max(1, ticketInventory + guestApproved + vipForEvent.length),
    guestListCheckedIn: guestCheckedIn,
    guestListApproved: guestApproved,
    ticketSold: ticketsSold,
    ticketInventory,
    vipConfirmed: vipForEvent.filter((reservation) => reservation.status === "confirmed" || reservation.status === "arrived").length,
    vipTotal: vipForEvent.length,
    refundRatePercent: ticketsSold > 0 ? (primaryEventRefunds.length / ticketsSold) * 100 : 0,
    retentionRatePercent,
    loyaltyEngagementPercent,
    incidentsPerEvent: incidentRate,
    inventoryVariancePercent: inventoryVariance,
  });

  const compositeScore = Math.round(scorecardComponents.reduce((sum, metric) => {
    const weight = INTELLIGENCE_WEIGHTS[metric.key as keyof typeof INTELLIGENCE_WEIGHTS] ?? 0;
    return sum + metric.value * weight;
  }, 0));

  return {
    scorecard: {
      scoreVersion: INTELLIGENCE_ALGORITHM_VERSION,
      compositeScore,
      status: "available",
      components: scorecardComponents,
      weights: { ...INTELLIGENCE_WEIGHTS },
    },
    attendanceForecast: attendance,
    revenueForecast: revenue,
    staffingRecommendation: staffing,
    inventoryRisks: inventory.sort((left, right) => right.shortageRisk - left.shortageRisk).slice(0, 12),
    eventHealth,
    customerSegments: segments,
    marketingRecommendations,
    anomalies,
    promoterInsights,
    pricingRecommendations,
    generatedAt: new Date().toISOString(),
  } satisfies IntelligenceOverview;
}

export async function runVenueIntelligenceSnapshot(reason: string) {
  const membership = await getCurrentOwnerVenue();
  const overview = await getOwnerIntelligenceOverview();

  const [run] = await db.insert(venueIntelligenceRuns).values({
    venueId: membership.venueId,
    eventId: null,
    triggeredByClerkUserId: membership.clerkUserId,
    runType: reason,
    status: "completed",
    startedAt: new Date(),
    finishedAt: new Date(),
    algorithmVersion: INTELLIGENCE_ALGORITHM_VERSION,
    providerUsed: "deterministic",
    metricsJson: JSON.stringify({ compositeScore: overview.scorecard.compositeScore }),
    limitationsJson: JSON.stringify([]),
  }).returning();

  await db.insert(venueIntelligenceSnapshots).values({
    venueId: membership.venueId,
    eventId: null,
    runId: run.id,
    snapshotType: "daily",
    summary: `${overview.scorecard.compositeScore ?? "N/A"} score with ${overview.anomalies.length} anomaly alerts.`,
    payloadJson: JSON.stringify(overview),
    generatedAt: new Date(),
    status: overview.scorecard.status,
    confidenceLevel: overview.attendanceForecast.confidenceLevel,
    confidenceScore: overview.attendanceForecast.confidenceScore,
    algorithmVersion: INTELLIGENCE_ALGORITHM_VERSION,
  });

  const eventId = overview.eventHealth[0]?.eventId ?? null;
  if (eventId) {
    await db.insert(venueEventForecasts).values({
      venueId: membership.venueId,
      eventId,
      runId: run.id,
      expectedAttendance: overview.attendanceForecast.expected,
      lowAttendance: overview.attendanceForecast.low,
      highAttendance: overview.attendanceForecast.high,
      expectedCapacityUtilization: overview.eventHealth[0]?.demandHealth ?? null,
      status: overview.attendanceForecast.status,
      confidenceLevel: overview.attendanceForecast.confidenceLevel,
      confidenceScore: overview.attendanceForecast.confidenceScore,
      keySignalsJson: JSON.stringify(overview.attendanceForecast.keySignals),
      assumptionsJson: JSON.stringify([]),
      limitationsJson: JSON.stringify(overview.attendanceForecast.limitations),
      generatedAt: new Date(),
    });
  }

  await db.insert(venueRevenueForecasts).values({
    venueId: membership.venueId,
    eventId,
    runId: run.id,
    confirmedGrossCents: overview.revenueForecast.confirmedGrossCents,
    confirmedNetCents: overview.revenueForecast.confirmedNetCents,
    estimatedGrossCents: overview.revenueForecast.estimatedGrossCents,
    estimatedNetCents: overview.revenueForecast.estimatedNetCents,
    pendingRevenueCents: overview.revenueForecast.pendingRevenueCents,
    refundedCents: overview.revenueForecast.refundedCents,
    lowNetCents: overview.revenueForecast.lowNetCents,
    highNetCents: overview.revenueForecast.highNetCents,
    status: overview.revenueForecast.status,
    confidenceLevel: overview.revenueForecast.confidenceLevel,
    confidenceScore: overview.revenueForecast.confidenceScore,
    assumptionsJson: JSON.stringify(overview.revenueForecast.assumptions),
    exclusionsJson: JSON.stringify(overview.revenueForecast.exclusions),
    generatedAt: new Date(),
  });

  if (overview.inventoryRisks.length > 0) {
    await db.insert(venueInventoryForecasts).values(
      overview.inventoryRisks.map((risk) => ({
        venueId: membership.venueId,
        eventId,
        runId: run.id,
        itemId: risk.itemId,
        expectedConsumption: risk.expectedConsumption,
        recommendedQuantity: risk.recommendedAvailable,
        reorderQuantity: risk.reorderQuantity,
        shortageRisk: risk.shortageRisk,
        overstockRisk: risk.overstockRisk,
        status: risk.status,
        confidenceLevel: risk.provenance.confidenceLevel,
        assumptionsJson: JSON.stringify(risk.assumptions),
        generatedAt: new Date(),
      }))
    );
  }

  if (overview.marketingRecommendations.length > 0) {
    await db.insert(venueMarketingRecommendations).values(
      overview.marketingRecommendations.map((recommendation) => ({
        venueId: membership.venueId,
        eventId,
        runId: run.id,
        recommendationType: "marketing" as const,
        title: recommendation.title,
        objective: recommendation.goal,
        audienceLabel: recommendation.audience,
        channel: recommendation.channel,
        timingLabel: recommendation.timing,
        messageAngle: recommendation.messageAngle,
        reason: recommendation.expectedReason,
        restrictionsJson: JSON.stringify(recommendation.restrictions),
        status: recommendation.provenance.status,
        confidenceLevel: recommendation.confidenceLevel,
        confidenceScore: recommendation.provenance.confidenceScore,
        requiresApproval: true,
        generatedAt: new Date(),
      }))
    );
  }

  if (overview.promoterInsights.length > 0) {
    await db.insert(venuePromoterInsights).values(
      overview.promoterInsights.map((insight) => ({
        venueId: membership.venueId,
        eventId,
        promoterProfileId: insight.promoterProfileId,
        runId: run.id,
        metricsJson: JSON.stringify({
          assignedEvents: insight.assignedEvents,
          ticketSales: insight.ticketSales,
          guestListArrivals: insight.guestListArrivals,
          conversionRate: insight.conversionRate,
          attributedRevenueCents: insight.attributedRevenueCents,
        }),
        recommendation: insight.recommendation,
        status: insight.status,
        confidenceLevel: insight.provenance.confidenceLevel,
        generatedAt: new Date(),
      }))
    );
  }

  if (overview.pricingRecommendations.length > 0) {
    await db.insert(venuePricingRecommendations).values(
      overview.pricingRecommendations.map((recommendation) => ({
        venueId: membership.venueId,
        eventId,
        runId: run.id,
        productType: recommendation.productType,
        productRefId: null,
        currentPriceCents: recommendation.currentPriceCents,
        suggestedLowCents: recommendation.suggestedLowCents,
        suggestedHighCents: recommendation.suggestedHighCents,
        rationale: recommendation.rationale,
        riskLabel: recommendation.risk,
        confidenceLevel: recommendation.confidenceLevel,
        status: recommendation.status,
        effectiveWindowStart: new Date(),
        effectiveWindowEnd: null,
        requiresApproval: recommendation.requiresApproval,
        generatedAt: new Date(),
      }))
    );
  }

  if (overview.anomalies.length > 0) {
    await db.insert(venueAnomalies).values(
      overview.anomalies.map((anomaly) => ({
        venueId: membership.venueId,
        eventId,
        runId: run.id,
        metricKey: anomaly.metric,
        severity: anomaly.severity,
        expectedLow: Number(anomaly.expectedRange.split(" to ")[0]) || null,
        expectedHigh: Number(anomaly.expectedRange.split(" to ")[1]) || null,
        actualValue: Number(anomaly.actualValue) || null,
        confidenceLevel: anomaly.confidenceLevel,
        explanation: anomaly.possibleExplanations.join(" "),
        recommendation: anomaly.recommendedInvestigation,
        status: anomaly.status,
        generatedAt: new Date(),
      }))
    );
  }

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_forecast_updated",
    metadata: { runId: run.id, reason },
  });

  return { runId: run.id, overview };
}

export async function getOwnerBusinessConversations() {
  const membership = await getCurrentOwnerVenue();
  return db
    .select()
    .from(venueAiConversations)
    .where(eq(venueAiConversations.venueId, membership.venueId))
    .orderBy(desc(venueAiConversations.updatedAt))
    .limit(30);
}

export async function getOwnerBusinessConversationMessages(conversationId: number) {
  const membership = await getCurrentOwnerVenue();

  const conversation = await db.query.venueAiConversations.findFirst({
    where: and(eq(venueAiConversations.id, conversationId), eq(venueAiConversations.venueId, membership.venueId)),
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  return db
    .select()
    .from(venueAiMessages)
    .where(eq(venueAiMessages.conversationId, conversationId))
    .orderBy(asc(venueAiMessages.createdAt))
    .limit(120);
}

export async function askNightlyForBusiness(question: string, conversationId?: number | null): Promise<{ conversationId: number; answer: AskBusinessAnswer }> {
  const membership = await getCurrentOwnerVenue();
  const overview = await getOwnerIntelligenceOverview();

  let resolvedConversationId = conversationId ?? null;
  if (!resolvedConversationId) {
    const [conversation] = await db.insert(venueAiConversations).values({
      venueId: membership.venueId,
      startedByClerkUserId: membership.clerkUserId,
      title: "Ask Nightly for Business",
      status: "active",
      contextJson: JSON.stringify({ generatedAt: overview.generatedAt }),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    resolvedConversationId = conversation.id;
  }

  const answer = await answerBusinessQuestion({ question, overview });

  await db.insert(venueAiMessages).values([
    {
      conversationId: resolvedConversationId,
      role: "user",
      content: question,
      structuredPayloadJson: JSON.stringify({ questionLength: question.length }),
      provenanceJson: JSON.stringify({ status: "available" }),
      providerUsed: "deterministic",
      modelVersion: INTELLIGENCE_ALGORITHM_VERSION,
    },
    {
      conversationId: resolvedConversationId,
      role: "assistant",
      content: answer.answer,
      structuredPayloadJson: JSON.stringify(answer.structured),
      provenanceJson: JSON.stringify(answer.provenance),
      providerUsed: answer.provenance.providerUsed,
      modelVersion: answer.provenance.modelVersion,
    },
  ]);

  await db.update(venueAiConversations).set({ updatedAt: new Date() }).where(eq(venueAiConversations.id, resolvedConversationId));

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_business_question_submitted",
    metadata: { conversationId: resolvedConversationId, questionLength: question.length },
  });

  return { conversationId: resolvedConversationId, answer };
}

export async function saveRecommendationFeedback(input: { recommendationId: number; feedbackType: string; notes: string }) {
  const membership = await getCurrentOwnerVenue();
  const recommendation = await db.query.venueInsightRecommendations.findFirst({
    where: and(eq(venueInsightRecommendations.id, input.recommendationId), eq(venueInsightRecommendations.venueId, membership.venueId)),
  });

  if (!recommendation) {
    throw new Error("Recommendation not found.");
  }

  await db.insert(venueInsightFeedback).values({
    venueId: membership.venueId,
    recommendationId: recommendation.id,
    submittedByClerkUserId: membership.clerkUserId,
    feedbackType: input.feedbackType,
    notes: input.notes || null,
    createdAt: new Date(),
  });

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_insight_feedback_submitted",
    metadata: {
      recommendationId: recommendation.id,
      feedbackType: input.feedbackType,
      notesLength: input.notes.length,
    },
  });
}

export async function createCampaignDraftFromTopRecommendation() {
  const membership = await getCurrentOwnerVenue();
  const recommendation = await db.query.venueMarketingRecommendations.findFirst({
    where: eq(venueMarketingRecommendations.venueId, membership.venueId),
    orderBy: desc(venueMarketingRecommendations.generatedAt),
  });

  if (!recommendation) {
    throw new Error("No marketing recommendation available.");
  }

  const draft = createCampaignDraftFromRecommendation({
    title: recommendation.title,
    goal: recommendation.objective,
    audience: recommendation.audienceLabel,
    timing: recommendation.timingLabel,
    channel: recommendation.channel as "push" | "email" | "sms" | "in_app" | "social",
    messageAngle: recommendation.messageAngle,
    expectedReason: recommendation.reason,
    requiresOwnerApproval: recommendation.requiresApproval,
    confidenceLevel: recommendation.confidenceLevel,
    restrictions: JSON.parse(recommendation.restrictionsJson) as string[],
    provenance: {
      sourceType: "database",
      sourceTables: ["venue_marketing_recommendations"],
      sourceWindowStart: null,
      sourceWindowEnd: null,
      generatedAt: recommendation.generatedAt.toISOString(),
      lastDataAt: recommendation.generatedAt.toISOString(),
      sampleSize: null,
      confidenceLevel: recommendation.confidenceLevel,
      confidenceScore: recommendation.confidenceScore,
      status: recommendation.status,
      limitations: [],
      isEstimated: false,
      isPartial: false,
      providerUsed: "deterministic",
      modelVersion: INTELLIGENCE_ALGORITHM_VERSION,
    },
  });

  const [saved] = await db.insert(venueCampaignDrafts).values({
    venueId: membership.venueId,
    recommendationId: null,
    channel: recommendation.channel,
    title: draft.title,
    subject: draft.subject,
    shortCopy: draft.shortCopy,
    longCopy: draft.longCopy,
    cta: draft.cta,
    audienceLabel: draft.audience,
    scheduleSuggestion: draft.scheduleSuggestion,
    complianceNotes: draft.complianceNotes,
    status: "proposed",
    requiresApproval: true,
    createdByClerkUserId: membership.clerkUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_campaign_draft_created",
    metadata: { draftId: saved.id, channel: saved.channel },
  });

  return saved;
}

export function buildOperationalSummaries(overview: IntelligenceOverview) {
  const preEvent = buildPreEventBriefing({
    eventTitle: overview.eventHealth[0]?.eventName ?? "Tonight",
    attendance: overview.attendanceForecast,
    revenue: overview.revenueForecast,
    staffing: overview.staffingRecommendation,
    inventoryRisks: overview.inventoryRisks.slice(0, 3).map((risk) => `${risk.itemName} ${Math.round(risk.shortageRisk * 100)}%`),
    promoterStatus: overview.promoterInsights.length > 0 ? "Active assignments tracked" : "No assignments",
    weatherStatus: "configuration_required",
  });

  const postEvent = buildPostEventRecap({
    eventTitle: overview.eventHealth[0]?.eventName ?? "Recent event",
    attendanceActual: overview.attendanceForecast.expected,
    revenueNetCents: overview.revenueForecast.confirmedNetCents,
    refundsCents: overview.revenueForecast.refundedCents,
    incidents: overview.anomalies.length,
    topFollowUps: overview.marketingRecommendations.slice(0, 2).map((rec) => rec.title),
  });

  return { preEvent, postEvent };
}
