"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { getCurrentOwnerVenue } from "@/app/owner/lib/ownership";
import { db } from "@/db";
import {
  bookingActivity,
  billSplits,
  bookingPayments,
  venueAiInsights,
  venueAddons,
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
  venueTables,
  venueServers,
  venueTimeEntries,
  venueVipReservations,
} from "@/db/schema";
import { buildVenueOsInsightSeed, createVenueOsAiAdapter } from "@/lib/venue-os/ai";

function toTrimmedString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalInt(value: FormDataEntryValue | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalDate(value: FormDataEntryValue | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? new Date(raw) : null;
}

function toBoolean(value: FormDataEntryValue | null | undefined) {
  return value === "on" || value === "true";
}

function toLines(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") {
    return [] as string[];
  }
  return value.split("\n").map((entry) => entry.trim()).filter(Boolean);
}

function toJson(value: Record<string, unknown> | string[]) {
  return JSON.stringify(value);
}

function redirectWithStatus(path: string, key: string) {
  redirect(`${path}?${key}=1`);
}

function revalidateVenueOsRoutes() {
  [
    "/owner",
    "/owner/operations",
    "/owner/staff",
    "/owner/scheduling",
    "/owner/floor",
    "/owner/tables",
    "/owner/vip",
    "/owner/inventory",
    "/owner/crm",
    "/owner/marketing",
    "/owner/loyalty",
    "/owner/reports",
    "/admin/venue-os",
  ].forEach((path) => revalidatePath(path));
}

async function auditVenueOs(action: string, entityType: string, entityId: number | string, metadata?: Record<string, unknown>) {
  const membership = await getCurrentOwnerVenue();
  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType,
    entityId,
    action,
    metadata,
  });
}

export async function inviteVenueStaffAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const [invite] = await db.insert(venueStaffInvitations).values({
    venueId: membership.venueId,
    invitedByClerkUserId: membership.clerkUserId,
    email: toTrimmedString(formData.get("email")),
    firstName: toTrimmedString(formData.get("firstName")) || null,
    lastName: toTrimmedString(formData.get("lastName")) || null,
    department: (toTrimmedString(formData.get("department")) as "management" | "door" | "security" | "bar" | "vip" | "operations" | "marketing" | "inventory" | "finance") || "operations",
    jobTitle: toTrimmedString(formData.get("jobTitle")) || "Staff",
    permissionsJson: toJson(toLines(formData.get("permissions"))),
    inviteToken: `staff-${randomUUID()}`,
    expiresAt: toOptionalDate(formData.get("expiresAt")),
  }).returning();

  await auditVenueOs("venue_staff_invited", "venue_staff_invitation", invite.id, { email: invite.email });
  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/staff", "invited");
}

export async function createVenueStaffProfileAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const [profile] = await db.insert(venueStaffProfiles).values({
    venueId: membership.venueId,
    firstName: toTrimmedString(formData.get("firstName")),
    lastName: toTrimmedString(formData.get("lastName")),
    email: toTrimmedString(formData.get("email")),
    phone: toTrimmedString(formData.get("phone")) || null,
    department: (toTrimmedString(formData.get("department")) as never) || "operations",
    jobTitle: toTrimmedString(formData.get("jobTitle")) || "Staff",
    permissionsJson: toJson(toLines(formData.get("permissions"))),
    hourlyRateCents: toOptionalInt(formData.get("hourlyRateCents")) ?? 0,
    status: "active",
    hiredAt: toOptionalDate(formData.get("hiredAt")),
    notes: toTrimmedString(formData.get("notes")) || null,
  }).returning();

  await auditVenueOs("venue_staff_created", "venue_staff_profile", profile.id, { email: profile.email });
  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/staff", "staffCreated");
}

export async function updateVenueStaffStatusAction(formData: FormData) {
  const status = toTrimmedString(formData.get("status"));
  const staffProfileId = toOptionalInt(formData.get("staffProfileId"));
  if (!staffProfileId || !status) {
    throw new Error("Staff status update is incomplete.");
  }

  await db.update(venueStaffProfiles).set({
    status: status as never,
    suspendedAt: status === "suspended" ? new Date() : null,
    terminatedAt: status === "terminated" ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(venueStaffProfiles.id, staffProfileId));

  await auditVenueOs("venue_staff_status_updated", "venue_staff_profile", staffProfileId, { status });
  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/staff", "staffUpdated");
}

export async function addVenueStaffCertificationAction(formData: FormData) {
  const staffProfileId = toOptionalInt(formData.get("staffProfileId"));
  if (!staffProfileId) {
    throw new Error("Staff profile is required.");
  }

  await db.insert(venueStaffCertifications).values({
    staffProfileId,
    certificationName: toTrimmedString(formData.get("certificationName")),
    issuer: toTrimmedString(formData.get("issuer")) || null,
    issuedAt: toOptionalDate(formData.get("issuedAt")),
    expiresAt: toOptionalDate(formData.get("expiresAt")),
    notes: toTrimmedString(formData.get("notes")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/staff", "certificationAdded");
}

export async function saveVenueStaffAvailabilityAction(formData: FormData) {
  const staffProfileId = toOptionalInt(formData.get("staffProfileId"));
  if (!staffProfileId) {
    throw new Error("Staff profile is required.");
  }

  await db.insert(venueStaffAvailability).values({
    staffProfileId,
    dayOfWeek: toOptionalInt(formData.get("dayOfWeek")) ?? 0,
    startTime: toTrimmedString(formData.get("startTime")) || null,
    endTime: toTrimmedString(formData.get("endTime")) || null,
    isPreferred: toBoolean(formData.get("isPreferred")),
    unavailableDatesJson: toJson(toLines(formData.get("unavailableDates"))),
    notes: toTrimmedString(formData.get("notes")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/scheduling", "availabilitySaved");
}

export async function createVenueShiftAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueShifts).values({
    venueId: membership.venueId,
    eventId: toOptionalInt(formData.get("eventId")),
    staffProfileId: toOptionalInt(formData.get("staffProfileId")),
    department: (toTrimmedString(formData.get("department")) as never) || "operations",
    shiftTitle: toTrimmedString(formData.get("shiftTitle")),
    roleLabel: toTrimmedString(formData.get("roleLabel")) || "Staff",
    status: (toTrimmedString(formData.get("status")) as never) || "scheduled",
    startsAt: toOptionalDate(formData.get("startsAt")) ?? new Date(),
    endsAt: toOptionalDate(formData.get("endsAt")) ?? new Date(),
    recurrenceRule: toTrimmedString(formData.get("recurrenceRule")) || null,
    isOpenShift: toBoolean(formData.get("isOpenShift")),
    managerApprovalRequired: toBoolean(formData.get("managerApprovalRequired")),
    overtimeWarningMinutes: toOptionalInt(formData.get("overtimeWarningMinutes")) ?? 0,
    notes: toTrimmedString(formData.get("notes")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/scheduling", "shiftCreated");
}

export async function createVenueShiftRequestAction(formData: FormData) {
  const shiftId = toOptionalInt(formData.get("shiftId"));
  const requesterStaffProfileId = toOptionalInt(formData.get("requesterStaffProfileId"));
  if (!shiftId || !requesterStaffProfileId) {
    throw new Error("Shift request is incomplete.");
  }

  await db.insert(venueShiftRequests).values({
    shiftId,
    requesterStaffProfileId,
    targetStaffProfileId: toOptionalInt(formData.get("targetStaffProfileId")),
    requestType: (toTrimmedString(formData.get("requestType")) as never) || "swap",
    reason: toTrimmedString(formData.get("reason")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/scheduling", "requestCreated");
}

export async function clockInVenueStaffAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const staffProfileId = toOptionalInt(formData.get("staffProfileId"));
  if (!staffProfileId) {
    throw new Error("Staff profile is required.");
  }

  await db.insert(venueTimeEntries).values({
    venueId: membership.venueId,
    shiftId: toOptionalInt(formData.get("shiftId")),
    staffProfileId,
    clockInAt: new Date(),
    attendanceStatus: "clocked_in",
    notes: toTrimmedString(formData.get("notes")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/scheduling", "clockedIn");
}

export async function clockOutVenueStaffAction(formData: FormData) {
  const timeEntryId = toOptionalInt(formData.get("timeEntryId"));
  if (!timeEntryId) {
    throw new Error("Time entry is required.");
  }

  await db.update(venueTimeEntries).set({
    clockOutAt: new Date(),
    breakMinutesTotal: toOptionalInt(formData.get("breakMinutesTotal")) ?? 0,
    attendanceStatus: "clocked_out",
    updatedAt: new Date(),
  }).where(eq(venueTimeEntries.id, timeEntryId));

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/scheduling", "clockedOut");
}

export async function createVenueOperationPlanAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueOperationPlans).values({
    venueId: membership.venueId,
    planType: toTrimmedString(formData.get("planType")) || "run_of_show",
    title: toTrimmedString(formData.get("title")),
    summary: toTrimmedString(formData.get("summary")) || null,
    scheduledFor: toOptionalDate(formData.get("scheduledFor")),
    metricsJson: toJson({ notes: toTrimmedString(formData.get("metricsNotes")) || null }),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/operations", "planCreated");
}

export async function createVenueOperationTaskAction(formData: FormData) {
  const planId = toOptionalInt(formData.get("planId"));
  if (!planId) {
    throw new Error("Plan is required.");
  }

  await db.insert(venueOperationTasks).values({
    planId,
    assignedStaffProfileId: toOptionalInt(formData.get("assignedStaffProfileId")),
    title: toTrimmedString(formData.get("title")),
    description: toTrimmedString(formData.get("description")) || null,
    priority: toTrimmedString(formData.get("priority")) || "normal",
    dueAt: toOptionalDate(formData.get("dueAt")),
    checklistJson: toJson(toLines(formData.get("checklist"))),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/operations", "taskCreated");
}

export async function createVenueFloorPlanAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueFloorPlans).values({
    venueId: membership.venueId,
    name: toTrimmedString(formData.get("name")),
    width: toOptionalInt(formData.get("width")) ?? 1200,
    height: toOptionalInt(formData.get("height")) ?? 800,
    backgroundImageUrl: toTrimmedString(formData.get("backgroundImageUrl")) || null,
    metadataJson: toJson({ notes: toTrimmedString(formData.get("notes")) || null }),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/floor", "floorPlanCreated");
}

export async function createVenueFloorObjectAction(formData: FormData) {
  const floorPlanId = toOptionalInt(formData.get("floorPlanId"));
  if (!floorPlanId) {
    throw new Error("Floor plan is required.");
  }

  await db.insert(venueFloorPlanObjects).values({
    floorPlanId,
    objectType: toTrimmedString(formData.get("objectType")) || "table",
    label: toTrimmedString(formData.get("label")),
    sectionName: toTrimmedString(formData.get("sectionName")) || null,
    capacity: toOptionalInt(formData.get("capacity")) ?? 0,
    coordinatesJson: toJson({ x: toOptionalInt(formData.get("x")) ?? 0, y: toOptionalInt(formData.get("y")) ?? 0, width: toOptionalInt(formData.get("width")) ?? 120, height: toOptionalInt(formData.get("height")) ?? 80 }),
    rotationDegrees: Number(toTrimmedString(formData.get("rotationDegrees")) || "0"),
    metadataJson: toJson({ notes: toTrimmedString(formData.get("notes")) || null }),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/floor", "floorObjectCreated");
}

export async function createVenueVipReservationAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueVipReservations).values({
    venueId: membership.venueId,
    reservationName: toTrimmedString(formData.get("reservationName")),
    eventId: toOptionalInt(formData.get("eventId")),
    customerProfileId: toOptionalInt(formData.get("customerProfileId")),
    bookedByStaffProfileId: toOptionalInt(formData.get("bookedByStaffProfileId")),
    serverStaffProfileId: toOptionalInt(formData.get("serverStaffProfileId")),
    hostStaffProfileId: toOptionalInt(formData.get("hostStaffProfileId")),
    floorObjectId: toOptionalInt(formData.get("floorObjectId")),
    partySize: toOptionalInt(formData.get("partySize")) ?? 2,
    minimumSpendCents: toOptionalInt(formData.get("minimumSpendCents")) ?? 0,
    finalSpendCents: toOptionalInt(formData.get("finalSpendCents")) ?? 0,
    status: (toTrimmedString(formData.get("status")) as never) || "pending",
    packageJson: toJson(toLines(formData.get("packageItems"))),
    notes: toTrimmedString(formData.get("notes")) || null,
    arrivalAt: toOptionalDate(formData.get("arrivalAt")),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/vip", "vipReservationCreated");
}

export async function createVenueBottlePackageAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueBottlePackages).values({
    venueId: membership.venueId,
    name: toTrimmedString(formData.get("name")),
    description: toTrimmedString(formData.get("description")) || null,
    priceCents: toOptionalInt(formData.get("priceCents")) ?? 0,
    packageItemsJson: toJson(toLines(formData.get("packageItems"))),
    mixersJson: toJson(toLines(formData.get("mixers"))),
    addOnsJson: toJson(toLines(formData.get("addOns"))),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/vip", "bottlePackageCreated");
}

export async function createVenueSupplierAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueSuppliers).values({
    venueId: membership.venueId,
    name: toTrimmedString(formData.get("name")),
    contactName: toTrimmedString(formData.get("contactName")) || null,
    email: toTrimmedString(formData.get("email")) || null,
    phone: toTrimmedString(formData.get("phone")) || null,
    leadTimeDays: toOptionalInt(formData.get("leadTimeDays")) ?? 0,
    notes: toTrimmedString(formData.get("notes")) || null,
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/inventory", "supplierCreated");
}

export async function createVenueInventoryItemAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueInventoryItems).values({
    venueId: membership.venueId,
    supplierId: toOptionalInt(formData.get("supplierId")),
    sku: toTrimmedString(formData.get("sku")) || `sku-${randomUUID().slice(0, 8)}`,
    name: toTrimmedString(formData.get("name")),
    category: toTrimmedString(formData.get("category")) || "general",
    unitLabel: toTrimmedString(formData.get("unitLabel")) || "unit",
    onHandQuantity: toOptionalInt(formData.get("onHandQuantity")) ?? 0,
    reorderThreshold: toOptionalInt(formData.get("reorderThreshold")) ?? 0,
    parQuantity: toOptionalInt(formData.get("parQuantity")) ?? 0,
    unitCostCents: toOptionalInt(formData.get("unitCostCents")) ?? 0,
    sellPriceCents: toOptionalInt(formData.get("sellPriceCents")) ?? 0,
    metadataJson: toJson({ notes: toTrimmedString(formData.get("notes")) || null }),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/inventory", "inventoryItemCreated");
}

export async function createVenueInventoryMovementAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueInventoryMovements).values({
    venueId: membership.venueId,
    itemId: toOptionalInt(formData.get("itemId")) ?? 0,
    movementType: (toTrimmedString(formData.get("movementType")) as never) || "adjust",
    quantity: toOptionalInt(formData.get("quantity")) ?? 0,
    referenceType: toTrimmedString(formData.get("referenceType")) || null,
    referenceId: toOptionalInt(formData.get("referenceId")),
    staffProfileId: toOptionalInt(formData.get("staffProfileId")),
    notes: toTrimmedString(formData.get("notes")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/inventory", "inventoryMovementCreated");
}

export async function createVenuePurchaseOrderAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venuePurchaseOrders).values({
    venueId: membership.venueId,
    supplierId: toOptionalInt(formData.get("supplierId")),
    createdByStaffProfileId: toOptionalInt(formData.get("createdByStaffProfileId")),
    status: (toTrimmedString(formData.get("status")) as never) || "draft",
    itemsJson: toJson(toLines(formData.get("items"))),
    subtotalCents: toOptionalInt(formData.get("subtotalCents")) ?? 0,
    taxCents: toOptionalInt(formData.get("taxCents")) ?? 0,
    totalCents: toOptionalInt(formData.get("totalCents")) ?? 0,
    expectedAt: toOptionalDate(formData.get("expectedAt")),
    notes: toTrimmedString(formData.get("notes")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/inventory", "purchaseOrderCreated");
}

export async function createVenueCustomerProfileAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueCustomerProfiles).values({
    venueId: membership.venueId,
    fullName: toTrimmedString(formData.get("fullName")),
    email: toTrimmedString(formData.get("email")) || null,
    phone: toTrimmedString(formData.get("phone")) || null,
    favoriteGenresJson: toJson(toLines(formData.get("favoriteGenres"))),
    favoriteEventsJson: toJson(toLines(formData.get("favoriteEvents"))),
    tagsJson: toJson(toLines(formData.get("tags"))),
    marketingEligible: toBoolean(formData.get("marketingEligible")),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/crm", "customerCreated");
}

export async function createVenueCustomerNoteAction(formData: FormData) {
  await db.insert(venueCustomerNotes).values({
    customerProfileId: toOptionalInt(formData.get("customerProfileId")) ?? 0,
    authorStaffProfileId: toOptionalInt(formData.get("authorStaffProfileId")),
    note: toTrimmedString(formData.get("note")),
    visibility: toTrimmedString(formData.get("visibility")) || "internal",
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/crm", "noteCreated");
}

export async function createVenueMarketingCampaignAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueMarketingCampaigns).values({
    venueId: membership.venueId,
    createdByStaffProfileId: toOptionalInt(formData.get("createdByStaffProfileId")),
    name: toTrimmedString(formData.get("name")),
    audienceLabel: toTrimmedString(formData.get("audienceLabel")) || "General audience",
    channel: (toTrimmedString(formData.get("channel")) as never) || "push",
    status: (toTrimmedString(formData.get("status")) as never) || "draft",
    audienceFilterJson: toJson({ segment: toTrimmedString(formData.get("segment")) || null }),
    contentJson: toJson({ subject: toTrimmedString(formData.get("subject")) || null, body: toTrimmedString(formData.get("body")) || null }),
    scheduledAt: toOptionalDate(formData.get("scheduledAt")),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/marketing", "campaignCreated");
}

export async function createVenueLoyaltyRewardAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueLoyaltyRewards).values({
    venueId: membership.venueId,
    name: toTrimmedString(formData.get("name")),
    description: toTrimmedString(formData.get("description")) || null,
    pointsCost: toOptionalInt(formData.get("pointsCost")) ?? 0,
    tierRequired: (toTrimmedString(formData.get("tierRequired")) as never) || "bronze",
    benefitJson: toJson({ detail: toTrimmedString(formData.get("benefitDetail")) || null }),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/loyalty", "rewardCreated");
}

export async function createVenueLoyaltyLedgerAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueLoyaltyLedger).values({
    venueId: membership.venueId,
    customerProfileId: toOptionalInt(formData.get("customerProfileId")) ?? 0,
    rewardId: toOptionalInt(formData.get("rewardId")),
    createdByStaffProfileId: toOptionalInt(formData.get("createdByStaffProfileId")),
    entryType: toTrimmedString(formData.get("entryType")) || "earn",
    pointsDelta: toOptionalInt(formData.get("pointsDelta")) ?? 0,
    spendCents: toOptionalInt(formData.get("spendCents")) ?? 0,
    description: toTrimmedString(formData.get("description")) || null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/loyalty", "ledgerCreated");
}

export async function createVenueAiInsightRequestAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const insightType = toTrimmedString(formData.get("insightType")) || "operational_summary";
  const adapter = createVenueOsAiAdapter();
  const input = {
    venueId: membership.venueId,
    eventId: toOptionalInt(formData.get("eventId")),
    insightType: insightType as Parameters<typeof buildVenueOsInsightSeed>[0]["insightType"],
    input: {
      notes: toTrimmedString(formData.get("notes")) || null,
      timeWindow: toTrimmedString(formData.get("timeWindow")) || null,
    },
  };
  const seed = buildVenueOsInsightSeed(input);
  const result = await adapter.requestInsight(input);

  await db.insert(venueAiInsights).values({
    venueId: membership.venueId,
    eventId: input.eventId,
    requestedByClerkUserId: membership.clerkUserId,
    insightType: input.insightType,
    status: result.status,
    inputJson: JSON.stringify(seed),
    outputJson: result.output ? JSON.stringify(result.output) : null,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/reports", "insightRequested");
}

export async function createVenueIncidentReportAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueIncidentReports).values({
    venueId: membership.venueId,
    eventId: toOptionalInt(formData.get("eventId")),
    reportedByStaffProfileId: toOptionalInt(formData.get("reportedByStaffProfileId")),
    severity: (toTrimmedString(formData.get("severity")) as never) || "low",
    category: toTrimmedString(formData.get("category")) || "general",
    summary: toTrimmedString(formData.get("summary")),
    details: toTrimmedString(formData.get("details")) || null,
    occurredAt: toOptionalDate(formData.get("occurredAt")),
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/operations", "incidentCreated");
}

export async function createVenueTableAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueTables).values({
    venueId: membership.venueId,
    floorObjectId: toOptionalInt(formData.get("floorObjectId")),
    tableCode: toTrimmedString(formData.get("tableCode")),
    name: toTrimmedString(formData.get("name")),
    sectionName: toTrimmedString(formData.get("sectionName")) || null,
    minimumGuests: toOptionalInt(formData.get("minimumGuests")) ?? 1,
    maximumGuests: toOptionalInt(formData.get("maximumGuests")) ?? 12,
    minimumSpendCents: toOptionalInt(formData.get("minimumSpendCents")) ?? 0,
    depositPercent: toOptionalInt(formData.get("depositPercent")) ?? 20,
    metadataJson: toJson({ notes: toTrimmedString(formData.get("notes")) || null }),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/tables", "tableCreated");
}

export async function createVenueServerAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueServers).values({
    venueId: membership.venueId,
    staffProfileId: toOptionalInt(formData.get("staffProfileId")),
    displayName: toTrimmedString(formData.get("displayName")),
    email: toTrimmedString(formData.get("email")) || null,
    phone: toTrimmedString(formData.get("phone")) || null,
    isLead: toBoolean(formData.get("isLead")),
    metadataJson: toJson({ notes: toTrimmedString(formData.get("notes")) || null }),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/vip", "serverCreated");
}

export async function createVenueAddonAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  await db.insert(venueAddons).values({
    venueId: membership.venueId,
    name: toTrimmedString(formData.get("name")),
    category: toTrimmedString(formData.get("category")) || "service",
    description: toTrimmedString(formData.get("description")) || null,
    unitPriceCents: toOptionalInt(formData.get("unitPriceCents")) ?? 0,
    isPerGuest: toBoolean(formData.get("isPerGuest")),
    metadataJson: toJson({ notes: toTrimmedString(formData.get("notes")) || null }),
    isActive: true,
  });

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/vip", "addonCreated");
}

export async function checkInVipReservationAction(formData: FormData) {
  const reservationId = toOptionalInt(formData.get("reservationId"));
  const bookingId = toOptionalInt(formData.get("bookingId"));
  const status = toTrimmedString(formData.get("status")) || "arrived";

  if (!reservationId) {
    throw new Error("Reservation ID is required.");
  }

  const now = new Date();
  await db.update(venueVipReservations).set({
    status: status as never,
    ...(status === "arrived" ? { arrivalAt: now } : {}),
    ...(status === "seated" ? { seatedAt: now } : {}),
    updatedAt: now,
  }).where(eq(venueVipReservations.id, reservationId));

  if (bookingId) {
    await db.insert(bookingActivity).values({
      bookingId,
      activityType: status === "seated" ? "vip_seated" : "vip_arrived",
      details: `VIP reservation marked ${status}.`,
      metadataJson: JSON.stringify({ reservationId }),
      createdAt: now,
    });

    await db.update(billSplits).set({
      status: status === "seated" ? "ready_to_collect" : "pending",
      updatedAt: now,
    }).where(eq(billSplits.bookingId, bookingId));

    await db.update(bookingPayments).set({
      status: status === "seated" ? "due" : "pending",
      ...(status === "seated" ? { dueAt: now } : {}),
      updatedAt: now,
    }).where(eq(bookingPayments.bookingId, bookingId));
  }

  revalidateVenueOsRoutes();
  redirectWithStatus("/owner/vip", "vipCheckinUpdated");
}