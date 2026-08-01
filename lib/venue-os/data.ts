import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { getCurrentOwnerVenue } from "@/app/owner/lib/ownership";
import { db } from "@/db";
import {
  bookings,
  ticketOrders,
  ticketRefunds,
  venueAiInsights,
  venueBottlePackages,
  venueCustomerNotes,
  venueCustomerProfiles,
  venueFloorPlanObjects,
  venueFloorPlans,
  venueIncidentReports,
  venueInventoryItems,
  venueInventoryMovements,
  venueLoyaltyLedger,
  venueLoyaltyRewards,
  venueMarketingCampaigns,
  venueOperationPlans,
  venueOperationTasks,
  venuePurchaseOrders,
  venueShiftRequests,
  venueShifts,
  venueStaffAvailability,
  venueStaffCertifications,
  venueStaffInvitations,
  venueStaffProfiles,
  venueSuppliers,
  venueTimeEntries,
  venueVipReservations,
  venues,
} from "@/db/schema";
import type { VenueOsFinancialSnapshot, VenueOsModuleKey, VenueOsSectionPayload } from "./types";

function parseJsonArray(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function toDetailDate(value: Date | null | undefined) {
  return value ? value.toLocaleString() : "Not scheduled";
}

async function currentVenue() {
  return getCurrentOwnerVenue();
}

export async function getVenueOsDashboardData() {
  const { venueId, venue, role } = await currentVenue();

  const [
    staffCount,
    upcomingShifts,
    activeVip,
    inventoryAlerts,
    campaigns,
    openIncidents,
    activePlans,
    aiQueue,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(venueStaffProfiles).where(eq(venueStaffProfiles.venueId, venueId)),
    db.select({ count: sql<number>`count(*)::int` }).from(venueShifts).where(and(eq(venueShifts.venueId, venueId), gte(venueShifts.startsAt, new Date()))),
    db.select({ count: sql<number>`count(*)::int` }).from(venueVipReservations).where(and(eq(venueVipReservations.venueId, venueId), eq(venueVipReservations.status, "confirmed"))),
    db.select({ count: sql<number>`count(*)::int` }).from(venueInventoryItems).where(and(eq(venueInventoryItems.venueId, venueId), sql`${venueInventoryItems.onHandQuantity} <= ${venueInventoryItems.reorderThreshold}`)),
    db.select({ count: sql<number>`count(*)::int` }).from(venueMarketingCampaigns).where(eq(venueMarketingCampaigns.venueId, venueId)),
    db.select({ count: sql<number>`count(*)::int` }).from(venueIncidentReports).where(and(eq(venueIncidentReports.venueId, venueId), eq(venueIncidentReports.status, "pending"))),
    db.select({ count: sql<number>`count(*)::int` }).from(venueOperationPlans).where(eq(venueOperationPlans.venueId, venueId)),
    db.select({ count: sql<number>`count(*)::int` }).from(venueAiInsights).where(eq(venueAiInsights.venueId, venueId)),
  ]);

  const recentNotes = await db
    .select({ id: venueCustomerNotes.id, note: venueCustomerNotes.note, createdAt: venueCustomerNotes.createdAt })
    .from(venueCustomerNotes)
    .orderBy(desc(venueCustomerNotes.createdAt))
    .limit(5);

  return {
    venue,
    role,
    metrics: [
      { label: "Staff", value: String(staffCount[0]?.count ?? 0), detail: "Active and invited team members" },
      { label: "Upcoming shifts", value: String(upcomingShifts[0]?.count ?? 0), detail: "Scheduled ahead" },
      { label: "VIP arrivals", value: String(activeVip[0]?.count ?? 0), detail: "Confirmed reservations" },
      { label: "Inventory alerts", value: String(inventoryAlerts[0]?.count ?? 0), detail: "At or below reorder" },
      { label: "Campaigns", value: String(campaigns[0]?.count ?? 0), detail: "Draft and scheduled" },
      { label: "Open incidents", value: String(openIncidents[0]?.count ?? 0), detail: "Operational follow-up" },
      { label: "Ops plans", value: String(activePlans[0]?.count ?? 0), detail: "Run-of-show and checklists" },
      { label: "AI queue", value: String(aiQueue[0]?.count ?? 0), detail: "Insight requests stored" },
    ],
    notes: recentNotes,
  };
}

export async function getStaffManagementData() {
  const { venueId } = await currentVenue();
  const [staff, invites, certifications] = await Promise.all([
    db.select().from(venueStaffProfiles).where(eq(venueStaffProfiles.venueId, venueId)).orderBy(asc(venueStaffProfiles.lastName), asc(venueStaffProfiles.firstName)).limit(24),
    db.select().from(venueStaffInvitations).where(eq(venueStaffInvitations.venueId, venueId)).orderBy(desc(venueStaffInvitations.createdAt)).limit(12),
    db.select().from(venueStaffCertifications).orderBy(desc(venueStaffCertifications.createdAt)).limit(20),
  ]);

  return {
    title: "Staff Management",
    description: "Employee directory, permissions, invitations, certifications, and employment lifecycle.",
    metrics: [
      { label: "Staff directory", value: String(staff.length) },
      { label: "Open invites", value: String(invites.filter((invite) => invite.status === "invited").length) },
      { label: "Suspended", value: String(staff.filter((member) => member.status === "suspended").length) },
      { label: "Certifications", value: String(certifications.length) },
    ],
    primaryQueue: staff.map((member) => ({ id: member.id, title: `${member.firstName} ${member.lastName}`, subtitle: `${member.department} • ${member.jobTitle}`, status: member.status, detail: member.email })),
    secondaryQueue: invites.map((invite) => ({ id: invite.id, title: invite.email, subtitle: `${invite.department} • ${invite.jobTitle}`, status: invite.status, detail: toDetailDate(invite.expiresAt) })),
  } satisfies VenueOsSectionPayload;
}

export async function getSchedulingData() {
  const { venueId } = await currentVenue();
  const [shifts, requests, timeEntries, availability] = await Promise.all([
    db.select().from(venueShifts).where(eq(venueShifts.venueId, venueId)).orderBy(asc(venueShifts.startsAt)).limit(20),
    db.select().from(venueShiftRequests).orderBy(desc(venueShiftRequests.createdAt)).limit(16),
    db.select().from(venueTimeEntries).where(eq(venueTimeEntries.venueId, venueId)).orderBy(desc(venueTimeEntries.clockInAt)).limit(20),
    db.select().from(venueStaffAvailability).orderBy(asc(venueStaffAvailability.dayOfWeek)).limit(20),
  ]);

  return {
    title: "Scheduling",
    description: "Recurring shifts, open coverage, swap requests, attendance, overtime warnings, and availability.",
    metrics: [
      { label: "Scheduled shifts", value: String(shifts.length) },
      { label: "Open shifts", value: String(shifts.filter((shift) => shift.isOpenShift).length) },
      { label: "Requests", value: String(requests.filter((request) => request.status === "pending").length) },
      { label: "Clocked in", value: String(timeEntries.filter((entry) => entry.clockOutAt == null).length) },
    ],
    primaryQueue: shifts.map((shift) => ({ id: shift.id, title: shift.shiftTitle, subtitle: `${shift.department} • ${shift.roleLabel}`, status: shift.status, detail: `${shift.startsAt.toLocaleString()} to ${shift.endsAt.toLocaleTimeString()}` })),
    secondaryQueue: requests.concat([]).slice(0, 12).map((request) => ({ id: request.id, title: request.requestType.replace(/_/g, " "), subtitle: request.reason ?? "No reason provided", status: request.status, detail: toDetailDate(request.createdAt) })),
    availability,
    timeEntries,
  };
}

export async function getOperationsData() {
  const { venueId } = await currentVenue();
  const [plans, tasks, incidents] = await Promise.all([
    db.select().from(venueOperationPlans).where(eq(venueOperationPlans.venueId, venueId)).orderBy(desc(venueOperationPlans.createdAt)).limit(16),
    db.select().from(venueOperationTasks).orderBy(desc(venueOperationTasks.createdAt)).limit(20),
    db.select().from(venueIncidentReports).where(eq(venueIncidentReports.venueId, venueId)).orderBy(desc(venueIncidentReports.createdAt)).limit(12),
  ]);

  return {
    title: "Event Operations",
    description: "Run of show, operational timelines, checklists, assigned tasks, and post-event reports.",
    metrics: [
      { label: "Plans", value: String(plans.length) },
      { label: "Tasks", value: String(tasks.length) },
      { label: "Blocked", value: String(tasks.filter((task) => task.status === "blocked").length), tone: "warning" },
      { label: "Incidents", value: String(incidents.length), tone: incidents.length > 0 ? "warning" : "good" },
    ],
    primaryQueue: plans.map((plan) => ({ id: plan.id, title: plan.title, subtitle: plan.planType, status: plan.status, detail: toDetailDate(plan.scheduledFor) })),
    secondaryQueue: tasks.slice(0, 12).map((task) => ({ id: task.id, title: task.title, subtitle: task.priority, status: task.status, detail: toDetailDate(task.dueAt) })),
    incidents,
  } satisfies VenueOsSectionPayload & { incidents: typeof incidents };
}

export async function getFloorData() {
  const { venueId } = await currentVenue();
  const [plans, objects] = await Promise.all([
    db.select().from(venueFloorPlans).where(eq(venueFloorPlans.venueId, venueId)).orderBy(desc(venueFloorPlans.isActive), asc(venueFloorPlans.name)).limit(10),
    db.select().from(venueFloorPlanObjects).orderBy(asc(venueFloorPlanObjects.objectType), asc(venueFloorPlanObjects.label)).limit(50),
  ]);

  return {
    title: "Floor Management",
    description: "Interactive layout editing for tables, sections, bars, VIP, cameras, DJ booth, and emergency exits.",
    metrics: [
      { label: "Floor plans", value: String(plans.length) },
      { label: "Tables", value: String(objects.filter((object) => object.objectType === "table").length) },
      { label: "VIP zones", value: String(objects.filter((object) => object.objectType === "vip").length) },
      { label: "Security points", value: String(objects.filter((object) => object.objectType === "security").length) },
    ],
    primaryQueue: plans.map((plan) => ({ id: plan.id, title: plan.name, subtitle: `${plan.width} x ${plan.height}`, status: plan.isActive ? "active" : "inactive", detail: plan.backgroundImageUrl ?? "No background" })),
    secondaryQueue: objects.slice(0, 16).map((object) => ({ id: object.id, title: object.label, subtitle: object.objectType, status: object.isActive ? "active" : "inactive", detail: object.sectionName ?? "General floor" })),
    floorObjects: objects,
  };
}

export async function getVipData() {
  const { venueId } = await currentVenue();
  const [reservations, packages] = await Promise.all([
    db.select().from(venueVipReservations).where(eq(venueVipReservations.venueId, venueId)).orderBy(desc(venueVipReservations.createdAt)).limit(20),
    db.select().from(venueBottlePackages).where(eq(venueBottlePackages.venueId, venueId)).orderBy(desc(venueBottlePackages.isActive), asc(venueBottlePackages.name)).limit(20),
  ]);

  return {
    title: "VIP Operations",
    description: "Reservations, bottle packages, arrivals, seating, hosts, servers, and final spend tracking.",
    metrics: [
      { label: "Reservations", value: String(reservations.length) },
      { label: "Arrived", value: String(reservations.filter((reservation) => reservation.status === "arrived" || reservation.status === "seated").length) },
      { label: "Packages", value: String(packages.length) },
      { label: "Final spend", value: formatMoney(reservations.reduce((sum, reservation) => sum + reservation.finalSpendCents, 0)) },
    ],
    primaryQueue: reservations.map((reservation) => ({ id: reservation.id, title: reservation.reservationName, subtitle: `Party of ${reservation.partySize}`, status: reservation.status, detail: formatMoney(reservation.minimumSpendCents) })),
    secondaryQueue: packages.map((pkg) => ({ id: pkg.id, title: pkg.name, subtitle: pkg.description ?? "Bottle package", status: pkg.isActive ? "active" : "inactive", detail: formatMoney(pkg.priceCents) })),
  } satisfies VenueOsSectionPayload;
}

export async function getInventoryData() {
  const { venueId } = await currentVenue();
  const [items, movements, suppliers, purchaseOrders] = await Promise.all([
    db.select().from(venueInventoryItems).where(eq(venueInventoryItems.venueId, venueId)).orderBy(asc(venueInventoryItems.name)).limit(30),
    db.select().from(venueInventoryMovements).where(eq(venueInventoryMovements.venueId, venueId)).orderBy(desc(venueInventoryMovements.createdAt)).limit(20),
    db.select().from(venueSuppliers).where(eq(venueSuppliers.venueId, venueId)).orderBy(asc(venueSuppliers.name)).limit(20),
    db.select().from(venuePurchaseOrders).where(eq(venuePurchaseOrders.venueId, venueId)).orderBy(desc(venuePurchaseOrders.createdAt)).limit(20),
  ]);

  return {
    title: "Inventory",
    description: "Stock levels, receives, waste, damage, transfers, suppliers, purchase orders, and reorder alerts.",
    metrics: [
      { label: "Items", value: String(items.length) },
      { label: "Alerts", value: String(items.filter((item) => item.onHandQuantity <= item.reorderThreshold).length), tone: "warning" },
      { label: "Suppliers", value: String(suppliers.length) },
      { label: "Open POs", value: String(purchaseOrders.filter((order) => order.status !== "received" && order.status !== "cancelled").length) },
    ],
    primaryQueue: items.map((item) => ({ id: item.id, title: item.name, subtitle: `${item.category} • ${item.unitLabel}`, status: item.isActive ? "active" : "inactive", detail: `${item.onHandQuantity} on hand / ${item.reorderThreshold} reorder` })),
    secondaryQueue: movements.map((movement) => ({ id: movement.id, title: movement.movementType, subtitle: movement.notes ?? "Inventory change", status: String(movement.quantity), detail: movement.createdAt.toLocaleString() })),
    suppliers,
    purchaseOrders,
  };
}

export async function getCrmData() {
  const { venueId } = await currentVenue();
  const [profiles, notes] = await Promise.all([
    db.select().from(venueCustomerProfiles).where(eq(venueCustomerProfiles.venueId, venueId)).orderBy(desc(venueCustomerProfiles.lifetimeSpendCents)).limit(20),
    db.select().from(venueCustomerNotes).orderBy(desc(venueCustomerNotes.createdAt)).limit(20),
  ]);

  return {
    title: "CRM",
    description: "Customer profiles, visit history, spend, tags, notes, and marketing eligibility.",
    metrics: [
      { label: "Profiles", value: String(profiles.length) },
      { label: "VIP guests", value: String(profiles.filter((profile) => profile.vipVisitCount > 0).length) },
      { label: "Eligible", value: String(profiles.filter((profile) => profile.marketingEligible).length) },
      { label: "Tracked spend", value: formatMoney(profiles.reduce((sum, profile) => sum + profile.lifetimeSpendCents, 0)) },
    ],
    primaryQueue: profiles.map((profile) => ({ id: profile.id, title: profile.fullName, subtitle: parseJsonArray(profile.tagsJson).join(", ") || "No tags", status: profile.loyaltyTier, detail: formatMoney(profile.lifetimeSpendCents) })),
    secondaryQueue: notes.map((note) => ({ id: note.id, title: note.note.slice(0, 48), subtitle: note.visibility, detail: note.createdAt.toLocaleString() })),
  } satisfies VenueOsSectionPayload;
}

export async function getMarketingData() {
  const { venueId } = await currentVenue();
  const campaigns = await db.select().from(venueMarketingCampaigns).where(eq(venueMarketingCampaigns.venueId, venueId)).orderBy(desc(venueMarketingCampaigns.createdAt)).limit(20);

  return {
    title: "Marketing",
    description: "Campaign builder, audience targeting, birthday/reactivation flows, announcement center, and delivery hooks.",
    metrics: [
      { label: "Campaigns", value: String(campaigns.length) },
      { label: "Scheduled", value: String(campaigns.filter((campaign) => campaign.status === "scheduled").length) },
      { label: "Sent", value: String(campaigns.filter((campaign) => campaign.status === "sent").length) },
      { label: "Channels", value: String(new Set(campaigns.map((campaign) => campaign.channel)).size) },
    ],
    primaryQueue: campaigns.map((campaign) => ({ id: campaign.id, title: campaign.name, subtitle: `${campaign.channel} • ${campaign.audienceLabel}`, status: campaign.status, detail: toDetailDate(campaign.scheduledAt) })),
    secondaryQueue: [],
  } satisfies VenueOsSectionPayload;
}

export async function getLoyaltyData() {
  const { venueId } = await currentVenue();
  const [rewards, ledger] = await Promise.all([
    db.select().from(venueLoyaltyRewards).where(eq(venueLoyaltyRewards.venueId, venueId)).orderBy(desc(venueLoyaltyRewards.isActive), asc(venueLoyaltyRewards.pointsCost)).limit(20),
    db.select().from(venueLoyaltyLedger).where(eq(venueLoyaltyLedger.venueId, venueId)).orderBy(desc(venueLoyaltyLedger.createdAt)).limit(20),
  ]);

  return {
    title: "Loyalty",
    description: "Points, tiers, rewards, benefits, referrals, and redemption history.",
    metrics: [
      { label: "Rewards", value: String(rewards.length) },
      { label: "Active rewards", value: String(rewards.filter((reward) => reward.isActive).length) },
      { label: "Ledger entries", value: String(ledger.length) },
      { label: "Points issued", value: String(ledger.reduce((sum, entry) => sum + Math.max(entry.pointsDelta, 0), 0)) },
    ],
    primaryQueue: rewards.map((reward) => ({ id: reward.id, title: reward.name, subtitle: reward.description ?? "Reward", status: reward.tierRequired, detail: `${reward.pointsCost} pts` })),
    secondaryQueue: ledger.map((entry) => ({ id: entry.id, title: entry.entryType, subtitle: entry.description ?? "Loyalty entry", detail: `${entry.pointsDelta} pts` })),
  } satisfies VenueOsSectionPayload;
}

export async function getFinancialData() {
  const { venueId } = await currentVenue();

  const [ticketRevenue, bookingRevenue, vipRevenue, bottleRevenue, refunds] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${ticketOrders.totalCents}), 0)::int` }).from(ticketOrders).where(eq(ticketOrders.eventId, ticketOrders.eventId)),
    db.select({ total: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int` }).from(bookings).where(eq(bookings.venueId, venueId)),
    db.select({ total: sql<number>`coalesce(sum(${venueVipReservations.finalSpendCents}), 0)::int` }).from(venueVipReservations).where(eq(venueVipReservations.venueId, venueId)),
    db.select({ total: sql<number>`coalesce(sum(${venueBottlePackages.priceCents}), 0)::int` }).from(venueBottlePackages).where(eq(venueBottlePackages.venueId, venueId)),
    db.select({ total: sql<number>`coalesce(sum(${ticketRefunds.amountCents}), 0)::int` }).from(ticketRefunds).where(eq(ticketRefunds.eventId, ticketRefunds.eventId)),
  ]);

  const snapshot: VenueOsFinancialSnapshot = {
    ticketRevenueCents: ticketRevenue[0]?.total ?? 0,
    bookingRevenueCents: bookingRevenue[0]?.total ?? 0,
    vipRevenueCents: vipRevenue[0]?.total ?? 0,
    bottleRevenueCents: bottleRevenue[0]?.total ?? 0,
    refundsCents: refunds[0]?.total ?? 0,
    taxesCents: 0,
    platformFeesCents: 0,
    promoterCommissionsCents: 0,
  };

  return snapshot;
}

export async function getReportsData() {
  const [dashboard, financial, aiInsights] = await Promise.all([
    getVenueOsDashboardData(),
    getFinancialData(),
    db.select().from(venueAiInsights).orderBy(desc(venueAiInsights.createdAt)).limit(12),
  ]);

  return {
    title: "Reports",
    description: "Revenue, staffing, marketing, operations, and AI insight request history.",
    metrics: [
      { label: "Ticket revenue", value: formatMoney(financial.ticketRevenueCents) },
      { label: "Booking revenue", value: formatMoney(financial.bookingRevenueCents) },
      { label: "VIP revenue", value: formatMoney(financial.vipRevenueCents) },
      { label: "Bottle revenue", value: formatMoney(financial.bottleRevenueCents) },
      { label: "Refunds", value: formatMoney(financial.refundsCents), tone: financial.refundsCents > 0 ? "warning" : "good" },
      { label: "Insight requests", value: String(aiInsights.length) },
    ],
    primaryQueue: aiInsights.map((insight) => ({ id: insight.id, title: insight.insightType.replace(/_/g, " "), subtitle: insight.status, detail: insight.createdAt.toLocaleString() })),
    secondaryQueue: dashboard.notes.map((note) => ({ id: note.id, title: note.note.slice(0, 48), detail: note.createdAt.toLocaleString() })),
    financial,
  } satisfies VenueOsSectionPayload & { financial: VenueOsFinancialSnapshot };
}

export async function getVenueOsSectionData(moduleKey: VenueOsModuleKey) {
  switch (moduleKey) {
    case "staff":
      return getStaffManagementData();
    case "scheduling":
      return getSchedulingData();
    case "operations":
      return getOperationsData();
    case "floor":
    case "tables":
      return getFloorData();
    case "vip":
      return getVipData();
    case "inventory":
      return getInventoryData();
    case "crm":
      return getCrmData();
    case "marketing":
      return getMarketingData();
    case "loyalty":
      return getLoyaltyData();
    case "reports":
      return getReportsData();
    default:
      return getOperationsData();
  }
}

export async function getAdminVenueOsData() {
  const [venueRows, staffCount, incidentCount, campaignCount, aiCount] = await Promise.all([
    db.select({ id: venues.id, name: venues.name, city: venues.city, publicationStatus: venues.publicationStatus }).from(venues).orderBy(asc(venues.name)).limit(40),
    db.select({ count: sql<number>`count(*)::int` }).from(venueStaffProfiles),
    db.select({ count: sql<number>`count(*)::int` }).from(venueIncidentReports),
    db.select({ count: sql<number>`count(*)::int` }).from(venueMarketingCampaigns),
    db.select({ count: sql<number>`count(*)::int` }).from(venueAiInsights),
  ]);

  return {
    metrics: [
      { label: "Venues", value: String(venueRows.length) },
      { label: "Staff records", value: String(staffCount[0]?.count ?? 0) },
      { label: "Incidents", value: String(incidentCount[0]?.count ?? 0) },
      { label: "Campaigns", value: String(campaignCount[0]?.count ?? 0) },
      { label: "AI requests", value: String(aiCount[0]?.count ?? 0) },
    ],
    venues: venueRows,
  };
}