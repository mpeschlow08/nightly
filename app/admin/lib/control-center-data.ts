import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  adminAuditEvents,
  adminCases,
  adminExportJobs,
  bookingDisputes,
  bookingRefunds,
  bookings,
  conciergeMessages,
  djProfiles,
  fraudCases,
  moderationReports,
  platformFeatureFlags,
  platformHealthChecks,
  platformIncidents,
  platformJobs,
  platformLaunchReadinessSnapshots,
  platformProviderHealth,
  platformFeedback,
  socialReports,
  supportCases,
  ticketOrders,
  tickets,
  users,
  venueClaimRequests,
  venueIntelligenceRuns,
} from "@/db/schema";

async function count(tableName: string) {
  const rows = await db.execute<{ count: string }>(sql.raw(`select count(*)::text as count from ${tableName}`));
  const raw = rows.rows[0]?.count ?? "0";
  return Number.parseInt(raw, 10);
}

export type MetricState = "confirmed" | "estimated" | "pending" | "unavailable";

export type OverviewMetric = {
  label: string;
  value: string;
  state: MetricState;
  note?: string;
};

export async function getOverviewMetrics(): Promise<OverviewMetric[]> {
  const [
    totalUsers,
    totalVenues,
    totalDjs,
    totalEvents,
    totalBookings,
    totalTickets,
    totalOrders,
    bookingRefundCount,
    bookingDisputeCount,
    openFraudCases,
    moderationQueue,
    supportQueue,
    openClaims,
    intelligenceRuns,
    providerHealthRows,
    systemHealthRows,
  ] = await Promise.all([
    count("users"),
    count("venues"),
    count("dj_profiles"),
    count("events"),
    count("bookings"),
    count("tickets"),
    count("ticket_orders"),
    count("booking_refunds"),
    count("booking_disputes"),
    count("fraud_cases"),
    count("moderation_reports"),
    count("support_cases"),
    count("venue_claim_requests"),
    count("venue_intelligence_runs"),
    db.select().from(platformProviderHealth).orderBy(desc(platformProviderHealth.updatedAt)).limit(6),
    db.select().from(platformHealthChecks).orderBy(desc(platformHealthChecks.checkedAt)).limit(6),
  ]);

  const providerState: MetricState =
    providerHealthRows.length === 0
      ? "unavailable"
      : providerHealthRows.some((row) => row.status === "down")
        ? "pending"
        : providerHealthRows.some((row) => row.status === "degraded")
          ? "estimated"
          : "confirmed";

  const systemState: MetricState =
    systemHealthRows.length === 0
      ? "unavailable"
      : systemHealthRows.some((row) => row.status === "down")
        ? "pending"
        : systemHealthRows.some((row) => row.status === "degraded")
          ? "estimated"
          : "confirmed";

  return [
    { label: "Total users", value: totalUsers.toLocaleString(), state: "confirmed" },
    { label: "Venues", value: totalVenues.toLocaleString(), state: "confirmed" },
    { label: "DJs", value: totalDjs.toLocaleString(), state: "confirmed" },
    { label: "Events", value: totalEvents.toLocaleString(), state: "confirmed" },
    { label: "Bookings", value: totalBookings.toLocaleString(), state: "confirmed" },
    { label: "Tickets sold", value: totalTickets.toLocaleString(), state: "confirmed" },
    { label: "Orders", value: totalOrders.toLocaleString(), state: "confirmed" },
    { label: "Refund records", value: bookingRefundCount.toLocaleString(), state: "confirmed" },
    { label: "Disputes", value: bookingDisputeCount.toLocaleString(), state: "confirmed" },
    { label: "Fraud flags", value: openFraudCases.toLocaleString(), state: "pending" },
    { label: "Moderation queue", value: moderationQueue.toLocaleString(), state: "pending" },
    { label: "Support volume", value: supportQueue.toLocaleString(), state: "pending" },
    { label: "Pending venue claims", value: openClaims.toLocaleString(), state: "pending" },
    { label: "Intelligence runs", value: intelligenceRuns.toLocaleString(), state: "confirmed" },
    { label: "Provider health", value: providerHealthRows.length === 0 ? "Not configured" : "Available", state: providerState },
    { label: "System health", value: systemHealthRows.length === 0 ? "No checks yet" : "Tracked", state: systemState },
  ];
}

export async function getAdminUsersSnapshot(limit = 40) {
  return db
    .select({
      id: users.id,
      clerkUserId: users.clerkUserId,
      role: users.role,
      accountStatus: users.accountStatus,
      requiresReverification: users.requiresReverification,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function getAdminUserDetail(userId: number) {
  const userRow = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (!userRow) {
    return {
      user: null,
      venueMemberships: [],
      djProfile: null,
      bookings: [],
      tickets: [],
      disputes: [],
      reports: [],
      audits: [],
    };
  }

  const [venuesRows, djRow, bookingRows, ticketRows, disputeRows, reportRows, auditRows] = await Promise.all([
    db.execute<{ venue_id: number; role: string }>(sql`
      select venue_id, role::text
      from venue_members
      where clerk_user_id = ${userRow.clerkUserId}
      order by venue_id desc
      limit 20
    `),
    db.query.djProfiles.findFirst({ where: eq(djProfiles.userId, userId) }),
    db
      .select({ id: bookings.id, bookingNumber: bookings.bookingNumber, lifecycleStatus: bookings.lifecycleStatus, createdAt: bookings.createdAt })
      .from(bookings)
      .where(
        sql`${bookings.requesterClerkUserId} = ${userRow.clerkUserId} or ${bookings.consumerClerkUserId} = ${userRow.clerkUserId}`
      )
      .limit(20),
    db
      .select({ id: tickets.id, status: tickets.status, createdAt: tickets.createdAt })
      .from(tickets)
      .where(eq(tickets.holderUserId, userId))
      .limit(20),
    db
      .select({ id: bookingDisputes.id, status: bookingDisputes.status, createdAt: bookingDisputes.createdAt })
      .from(bookingDisputes)
      .where(eq(bookingDisputes.openedByClerkUserId, userRow.clerkUserId))
      .limit(20),
    db
      .select({ id: socialReports.id, status: socialReports.status, createdAt: socialReports.createdAt })
      .from(socialReports)
      .where(eq(socialReports.reporterUserId, userId))
      .limit(20),
    db
      .select({ id: adminAuditEvents.id, action: adminAuditEvents.action, createdAt: adminAuditEvents.createdAt })
      .from(adminAuditEvents)
      .where(eq(adminAuditEvents.resourceId, String(userId)))
      .orderBy(desc(adminAuditEvents.createdAt))
      .limit(30),
  ]);

  return {
    user: userRow,
    venueMemberships: venuesRows.rows,
    djProfile: djRow,
    bookings: bookingRows,
    tickets: ticketRows,
    disputes: disputeRows,
    reports: reportRows,
    audits: auditRows,
  };
}

export async function getSectionPreview(section: string) {
  switch (section) {
    case "venue-claims":
      return db.select().from(venueClaimRequests).orderBy(desc(venueClaimRequests.createdAt)).limit(50);
    case "orders":
      return db.select().from(ticketOrders).orderBy(desc(ticketOrders.createdAt)).limit(50);
    case "refunds":
      return db.select().from(bookingRefunds).orderBy(desc(bookingRefunds.createdAt)).limit(50);
    case "disputes":
      return db.select().from(bookingDisputes).orderBy(desc(bookingDisputes.createdAt)).limit(50);
    case "fraud":
      return db.select().from(fraudCases).orderBy(desc(fraudCases.createdAt)).limit(50);
    case "moderation":
      return db.select().from(moderationReports).orderBy(desc(moderationReports.createdAt)).limit(50);
    case "social":
      return db.select().from(socialReports).orderBy(desc(socialReports.createdAt)).limit(50);
    case "concierge":
      return db.select().from(conciergeMessages).orderBy(desc(conciergeMessages.createdAt)).limit(50);
    case "intelligence":
      return db.select().from(venueIntelligenceRuns).orderBy(desc(venueIntelligenceRuns.createdAt)).limit(50);
    case "support":
      return db.select().from(supportCases).orderBy(desc(supportCases.createdAt)).limit(50);
    case "audit":
      return db.select().from(adminAuditEvents).orderBy(desc(adminAuditEvents.createdAt)).limit(80);
    case "feature-flags":
      return db.select().from(platformFeatureFlags).orderBy(desc(platformFeatureFlags.updatedAt)).limit(80);
    case "system":
      return db.select().from(platformHealthChecks).orderBy(desc(platformHealthChecks.checkedAt)).limit(80);
    case "jobs":
      return db.select().from(platformJobs).orderBy(desc(platformJobs.updatedAt)).limit(80);
    case "exports":
      return db.select().from(adminExportJobs).orderBy(desc(adminExportJobs.createdAt)).limit(80);
    case "incidents":
      return db.select().from(platformIncidents).orderBy(desc(platformIncidents.updatedAt)).limit(80);
    case "feedback":
      return db.select().from(platformFeedback).orderBy(desc(platformFeedback.updatedAt)).limit(80);
    case "launch-readiness":
      return db.select().from(platformLaunchReadinessSnapshots).orderBy(desc(platformLaunchReadinessSnapshots.generatedAt)).limit(80);
    default:
      return db.select().from(adminCases).orderBy(desc(adminCases.createdAt)).limit(50);
  }
}
