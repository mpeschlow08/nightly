import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  billSplits,
  bookingAuditLog,
  bookingActivity,
  bookingAddons,
  bookingAttachments,
  bookingBottles,
  bookingCheckins,
  bookingContracts,
  bookingContractVersions,
  bookingCouponUsage,
  bookingDiscounts,
  bookingDisputes,
  bookingMessages,
  bookingNotifications,
  bookingParticipants,
  bookingPayments,
  bookingPricing,
  bookingRequirements,
  bookingReviews,
  friends,
  bookingStatusHistory,
  socialProfiles,
  bookingItems,
  bookings,
  venueFloorPlanObjects,
  venueFloorPlans,
  djProfiles,
  tableBookings,
  venueAddons,
  venueBottlePackages,
  venueServers,
  venueTables,
  users,
  venues,
  bookingRefunds,
} from "@/db/schema";
import { getVenueTableOperationsSnapshot } from "@/lib/bookings/operations";
import { canViewBooking } from "@/lib/bookings/permissions";
import type { BookingLifecycleStatus, BookingRoleContext, BookingType } from "@/lib/bookings/types";
import { BOOKING_LIFECYCLE_STATUSES } from "@/lib/bookings/types";

export type BookingRequestOption = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  slug?: string | null;
};

export type BookingCatalogOption = {
  id: number;
  label: string;
  subtitle: string;
  amountCents: number;
};

export type ReservationLocationStatus = "available" | "reserved" | "occupied" | "blocked" | "cleaning" | "pending";

export type ReservationExperienceOption = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  requiresBottlePurchase: boolean;
};

export type ReservationFloorObject = {
  id: number;
  venueTableId: number | null;
  objectType: string;
  label: string;
  tableNumber: string;
  section: string | null;
  capacity: number;
  minimumSpendCents: number;
  reservationFeeCents: number;
  bottleMinimumCents: number;
  assignedServerSection: string | null;
  status: ReservationLocationStatus;
  notes: string | null;
  shape: "rect" | "circle" | "ellipse" | "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
  points: Array<{ x: number; y: number }>;
  enabledExperienceIds: string[];
  customExperiences: ReservationExperienceOption[];
};

export type ReservationFloor = {
  id: number;
  name: string;
  width: number;
  height: number;
  backgroundImageUrl: string | null;
  rotationDegrees: number;
  objects: ReservationFloorObject[];
};

export type ReservationServerProfile = {
  id: number;
  label: string;
  subtitle: string;
  photoUrl: string | null;
  nickname: string | null;
  languages: string[];
  bio: string | null;
  yearsEmployed: number | null;
  rating: number | null;
  sectionAssignment: string | null;
  availability: string;
  isLead: boolean;
};

export type ReservationProductOption = {
  id: number;
  label: string;
  subtitle: string;
  amountCents: number;
  category: string;
  imageUrl: string | null;
  description: string | null;
  inventory: number | null;
  featured: boolean;
  recommended: boolean;
  quantityLimit: number | null;
  mixers: string[];
};

export type ReservationFriendOption = {
  userId: number;
  clerkUserId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

export type ReservationVenueOption = BookingRequestOption & {
  heroImageUrl: string | null;
  googleAddress: string | null;
  googleMapsUrl: string | null;
  dressCode: string | null;
  parkingInformation: string | null;
  contactPhone: string | null;
  reservationPolicies: {
    allowDepositOnly: boolean;
    allowFullPayment: boolean;
    defaultDepositPercent: number;
  };
  experiences: ReservationExperienceOption[];
  floors: ReservationFloor[];
  servers: ReservationServerProfile[];
  bottlePackages: ReservationProductOption[];
  addons: ReservationProductOption[];
};

export type BookingDashboardRow = {
  id: number;
  bookingNumber: string;
  bookingType: BookingType;
  lifecycleStatus: BookingLifecycleStatus;
  city: string | null;
  timezone: string;
  requestedForAt: Date | null;
  requestedStartAt: Date | null;
  requestedEndAt: Date | null;
  guestCount: number;
  budgetCents: number;
  totalCents: number;
  counterOfferAmountCents: number | null;
  counterOfferDepositCents: number | null;
  counterOfferExpiresAt: Date | null;
  depositRequiredCents: number;
  payoutCents: number;
  currency: string;
  notes: string | null;
  cancellationReason: string | null;
  refundReason: string | null;
  disputeReason: string | null;
  consumerClerkUserId: string;
  djProfileId: number | null;
  djName: string | null;
  venueId: number | null;
  venueName: string | null;
  venueSlug: string | null;
  venueHeroImageUrl?: string | null;
  venueGoogleAddress?: string | null;
  venueGoogleMapsUrl?: string | null;
  venueDressCode?: string | null;
  venueParkingInformation?: string | null;
  venuePhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BookingDetailPayload = {
  booking: BookingDashboardRow | null;
  participants: Array<{
    id: number;
    participantRole: string;
    clerkUserId: string;
    displayName: string;
    email: string | null;
    isPrimary: boolean;
    responseStatus: string;
  }>;
  messages: Array<{
    id: number;
    senderRole: string;
    senderClerkUserId: string;
    messageType: string;
    body: string;
    isSystem: boolean;
    readAt: Date | null;
    createdAt: Date;
  }>;
  history: Array<{
    id: number;
    fromStatus: BookingLifecycleStatus | null;
    toStatus: BookingLifecycleStatus;
    actorClerkUserId: string;
    actorRole: string | null;
    note: string | null;
    createdAt: Date;
  }>;
  attachments: Array<{
    id: number;
    attachmentKind: string;
    fileName: string;
    fileUrl: string;
    thumbnailUrl: string | null;
    mimeType: string | null;
    messageId: number | null;
  }>;
  payments: Array<{
    id: number;
    provider: string;
    status: string;
    amountCents: number;
    currency: string;
    providerInvoiceId: string | null;
    providerReceiptUrl: string | null;
    paidAt: Date | null;
    refundedAt: Date | null;
    createdAt: Date;
  }>;
  refunds: Array<{
    id: number;
    amountCents: number;
    status: string;
    reason: string | null;
    requestedAt: Date;
    processedAt: Date | null;
  }>;
  disputes: Array<{
    id: number;
    subject: string;
    reason: string;
    status: string;
    adminNotes: string | null;
    resolvedAt: Date | null;
  }>;
  reviews: Array<{
    id: number;
    subjectType: string;
    rating: number;
    title: string | null;
    body: string | null;
    privateAdminNotes: string | null;
    createdAt: Date;
  }>;
  notifications: Array<{
    id: number;
    notificationType: string;
    recipientClerkUserId: string | null;
    status: string;
    scheduledAt: Date;
    sentAt: Date | null;
  }>;
  contracts: Array<{
    id: number;
    versionNumber: number;
    status: string;
    title: string;
    termsJson: string;
    acceptanceJson: string | null;
    generatedAt: Date;
    sentAt: Date | null;
    acceptedAt: Date | null;
    signedAt: Date | null;
  }>;
  contractVersions: Array<{
    id: number;
    versionNumber: number;
    contentJson: string;
    createdByClerkUserId: string;
    createdAt: Date;
  }>;
  pricing: Array<{
    id: number;
    pricingKind: string;
    quoteVersion: number;
    baseAmountCents: number;
    depositAmountCents: number;
    serviceFeeCents: number;
    taxCents: number;
    platformFeeCents: number;
    travelFeeCents: number;
    surgeFeeCents: number;
    discountCents: number;
    totalAmountCents: number;
    currency: string;
    quoteExpiresAt: Date | null;
    quoteNotes: string | null;
  }>;
  discounts: Array<{
    id: number;
    discountCode: string;
    discountKind: string;
    percentOff: number | null;
    amountOffCents: number | null;
    description: string | null;
  }>;
  couponUsage: Array<{
    id: number;
    couponCode: string;
    discountKind: string;
    discountCents: number;
  }>;
  requirements: Array<{
    id: number;
    requirementType: string;
    title: string;
    details: string | null;
    isRequired: boolean;
    isMet: boolean;
    status: string;
  }>;
  checkin: Array<{
    id: number;
    status: string;
    checkedInAt: Date | null;
    checkedInByClerkUserId: string | null;
    method: string | null;
    notes: string | null;
  }>;
  auditLog: Array<{
    id: number;
    action: string;
    actorClerkUserId: string;
    actorRole: string | null;
    metadataJson: string | null;
    createdAt: Date;
  }>;
  tableBooking: {
    id: number;
    venueTableId: number | null;
    tableName: string | null;
    serverId: number | null;
    serverName: string | null;
    bookingCategory: string;
    reservationName: string | null;
    partySize: number;
    reservationStartAt: Date | null;
    reservationEndAt: Date | null;
    status: string;
    minimumSpendCents: number;
    depositAmountCents: number;
    notes: string | null;
    metadataJson?: string;
  } | null;
  bookingItems: Array<{
    id: number;
    itemType: string;
    label: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
  }>;
  bottleSelections: Array<{
    id: number;
    bottlePackageId: number | null;
    label: string;
    quantity: number;
    unitPriceCents: number;
    notes: string | null;
  }>;
  addonSelections: Array<{
    id: number;
    venueAddonId: number | null;
    label: string;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    notes: string | null;
  }>;
  billSplits: Array<{
    id: number;
    payerDisplayName: string;
    payerEmail: string | null;
    splitPercent: number | null;
    amountCents: number;
    status: string;
    paidAt: Date | null;
  }>;
  activity: Array<{
    id: number;
    activityType: string;
    details: string | null;
    actorRole: string | null;
    createdAt: Date;
  }>;
  isAccessible: boolean;
};

export type BookingDashboardData = {
  rows: BookingDashboardRow[];
  totalCount: number;
  counts: Record<BookingLifecycleStatus, number>;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
  page: number;
  pageSize: number;
  query: string;
  status: BookingLifecycleStatus | "all";
};

export type BookingRequestOptions = {
  venues: ReservationVenueOption[];
  djs: BookingRequestOption[];
  vipTables: BookingCatalogOption[];
  bottlePackages: BookingCatalogOption[];
  addons: BookingCatalogOption[];
  servers: BookingCatalogOption[];
  friends: ReservationFriendOption[];
};

const DEFAULT_EXPERIENCES: ReservationExperienceOption[] = [
  { id: "table_only", label: "Table Only", description: "Reserve the table and settle bottle choices later.", enabled: true, requiresBottlePurchase: false },
  { id: "bottle_service", label: "Bottle Service", description: "Pre-order bottles and service for arrival.", enabled: true, requiresBottlePurchase: true },
  { id: "standing_vip", label: "Standing VIP", description: "Premium standing reservation near the action.", enabled: true, requiresBottlePurchase: true },
  { id: "cabana", label: "Cabana", description: "Large-format private cabana seating.", enabled: true, requiresBottlePurchase: true },
  { id: "lounge", label: "Lounge", description: "Soft seating for smaller groups and hosted nights.", enabled: true, requiresBottlePurchase: true },
];

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null | undefined): unknown[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeLocationStatus(value: string | null | undefined): ReservationLocationStatus {
  if (value === "reserved" || value === "occupied" || value === "cleaning" || value === "pending") {
    return value;
  }

  if (value === "vip_hold" || value === "out_of_service" || value === "blocked") {
    return "blocked";
  }

  return "available";
}

function inferExperienceOptions(objectType: string, metadata: Record<string, unknown>): ReservationExperienceOption[] {
  const configured = parseJsonArray(JSON.stringify(metadata.experiences ?? [])).map((entry) => {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : null;
    const label = typeof candidate.label === "string" ? candidate.label : null;
    if (!id || !label) {
      return null;
    }

    return {
      id,
      label,
      description: typeof candidate.description === "string" ? candidate.description : "Custom venue experience.",
      enabled: toBool(candidate.enabled, true),
      requiresBottlePurchase: toBool(candidate.requiresBottlePurchase, true),
    } satisfies ReservationExperienceOption;
  }).filter((entry): entry is ReservationExperienceOption => Boolean(entry));

  if (configured.length > 0) {
    return configured;
  }

  if (objectType === "cabana") {
    return DEFAULT_EXPERIENCES.filter((item) => item.id === "cabana" || item.id === "bottle_service");
  }

  if (objectType === "standing_vip") {
    return DEFAULT_EXPERIENCES.filter((item) => item.id === "standing_vip" || item.id === "bottle_service");
  }

  if (objectType === "lounge") {
    return DEFAULT_EXPERIENCES.filter((item) => item.id === "lounge" || item.id === "table_only");
  }

  return DEFAULT_EXPERIENCES;
}

function emptyCounts() {
  return BOOKING_LIFECYCLE_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = 0;
    return accumulator;
  }, {} as Record<BookingLifecycleStatus, number>);
}

export async function getBookingRequestOptions(actor?: Pick<BookingRoleContext, "clerkUserId">): Promise<BookingRequestOptions> {
  const actorUser = actor
    ? await db.query.users.findFirst({
        where: eq(users.clerkUserId, actor.clerkUserId),
        columns: { id: true },
      })
    : null;

  const [venueRows, djRows, vipTableRows, bottleRows, addonRows, serverRows, floorRows, floorObjectRows, friendRows] = await Promise.all([
    db
      .select({
        id: venues.id,
        name: venues.name,
        slug: venues.slug,
        city: venues.city,
        neighborhood: venues.neighborhood,
        heroImageUrl: venues.heroImageUrl,
        thumbnailImageUrl: venues.thumbnailImageUrl,
        googleFormattedAddress: venues.googleFormattedAddress,
        googleMapsUrl: venues.googleMapsUrl,
        dressCode: venues.dressCode,
        parkingInformation: venues.parkingInformation,
        phone: venues.phone,
      })
      .from(venues)
      .where(eq(venues.publicationStatus, "published"))
      .orderBy(desc(venues.isFeatured), desc(venues.vibeScore), asc(venues.name))
      .limit(24),
    db
      .select({
        id: djProfiles.id,
        stageName: djProfiles.stageName,
        username: djProfiles.username,
        city: djProfiles.city,
        profileImageUrl: djProfiles.profileImageUrl,
        genres: djProfiles.genres,
        isAvailableForBooking: djProfiles.isAvailableForBooking,
      })
      .from(djProfiles)
      .orderBy(desc(djProfiles.isAvailableForBooking), desc(djProfiles.updatedAt), asc(djProfiles.stageName))
      .limit(24),
    db
      .select({
        id: venueTables.id,
        venueId: venueTables.venueId,
        floorObjectId: venueTables.floorObjectId,
        tableCode: venueTables.tableCode,
        name: venueTables.name,
        sectionName: venueTables.sectionName,
        minimumSpendCents: venueTables.minimumSpendCents,
        metadataJson: venueTables.metadataJson,
      })
      .from(venueTables)
      .where(eq(venueTables.isActive, true))
      .orderBy(asc(venueTables.name))
      .limit(40),
    db
      .select({
        id: venueBottlePackages.id,
        venueId: venueBottlePackages.venueId,
        name: venueBottlePackages.name,
        description: venueBottlePackages.description,
        priceCents: venueBottlePackages.priceCents,
        packageItemsJson: venueBottlePackages.packageItemsJson,
        mixersJson: venueBottlePackages.mixersJson,
      })
      .from(venueBottlePackages)
      .where(eq(venueBottlePackages.isActive, true))
      .orderBy(asc(venueBottlePackages.name))
      .limit(40),
    db
      .select({
        id: venueAddons.id,
        venueId: venueAddons.venueId,
        name: venueAddons.name,
        category: venueAddons.category,
        description: venueAddons.description,
        unitPriceCents: venueAddons.unitPriceCents,
        metadataJson: venueAddons.metadataJson,
      })
      .from(venueAddons)
      .where(eq(venueAddons.isActive, true))
      .orderBy(asc(venueAddons.name))
      .limit(40),
    db
      .select({
        id: venueServers.id,
        venueId: venueServers.venueId,
        displayName: venueServers.displayName,
        isLead: venueServers.isLead,
        metadataJson: venueServers.metadataJson,
      })
      .from(venueServers)
      .where(eq(venueServers.isActive, true))
      .orderBy(desc(venueServers.isLead), asc(venueServers.displayName))
      .limit(40),
    db
      .select({
        id: venueFloorPlans.id,
        venueId: venueFloorPlans.venueId,
        name: venueFloorPlans.name,
        width: venueFloorPlans.width,
        height: venueFloorPlans.height,
        backgroundImageUrl: venueFloorPlans.backgroundImageUrl,
        metadataJson: venueFloorPlans.metadataJson,
      })
      .from(venueFloorPlans)
      .where(eq(venueFloorPlans.isActive, true))
      .orderBy(asc(venueFloorPlans.name)),
    db
      .select({
        id: venueFloorPlanObjects.id,
        floorPlanId: venueFloorPlanObjects.floorPlanId,
        objectType: venueFloorPlanObjects.objectType,
        label: venueFloorPlanObjects.label,
        sectionName: venueFloorPlanObjects.sectionName,
        capacity: venueFloorPlanObjects.capacity,
        coordinatesJson: venueFloorPlanObjects.coordinatesJson,
        rotationDegrees: venueFloorPlanObjects.rotationDegrees,
        metadataJson: venueFloorPlanObjects.metadataJson,
      })
      .from(venueFloorPlanObjects)
      .where(eq(venueFloorPlanObjects.isActive, true))
      .orderBy(asc(venueFloorPlanObjects.label)),
    actorUser
      ? db
          .select({
            userId: socialProfiles.userId,
            clerkUserId: socialProfiles.clerkUserId,
            displayName: socialProfiles.displayName,
            handle: socialProfiles.handle,
            avatarUrl: socialProfiles.avatarUrl,
          })
          .from(friends)
          .innerJoin(socialProfiles, eq(friends.friendUserId, socialProfiles.userId))
            .where(and(eq(friends.userId, actorUser.id), eq(friends.status, "active")))
          .orderBy(asc(socialProfiles.displayName))
          .limit(24)
      : Promise.resolve([]),
  ]);

  const tableSnapshotsByVenue = new Map<number, Awaited<ReturnType<typeof getVenueTableOperationsSnapshot>>>();
  for (const venue of venueRows) {
    tableSnapshotsByVenue.set(venue.id, await getVenueTableOperationsSnapshot(venue.id));
  }

  const tableRowsById = new Map(vipTableRows.map((row) => [row.id, row]));
  const tableStatusByTableId = new Map<number, ReservationLocationStatus>();
  for (const snapshotRows of tableSnapshotsByVenue.values()) {
    for (const row of snapshotRows) {
      tableStatusByTableId.set(row.id, normalizeLocationStatus(row.liveStatus));
    }
  }

  const floorByVenue = new Map<number, ReservationFloor[]>();
  for (const floor of floorRows) {
    const floorMetadata = parseJsonObject(floor.metadataJson);
    const objects = floorObjectRows
      .filter((object) => object.floorPlanId === floor.id)
      .map((object) => {
        const metadata = parseJsonObject(object.metadataJson);
        const coordinates = parseJsonObject(object.coordinatesJson);
        const linkedTableId = toNumberOrNull(metadata.venueTableId) ?? null;
        const linkedTable = linkedTableId ? tableRowsById.get(linkedTableId) ?? null : null;
        const tableMetadata = linkedTable ? parseJsonObject(linkedTable.metadataJson) : {};
        const liveStatus = linkedTableId ? tableStatusByTableId.get(linkedTableId) ?? normalizeLocationStatus(typeof metadata.status === "string" ? metadata.status : null) : normalizeLocationStatus(typeof metadata.status === "string" ? metadata.status : null);
        const shape = typeof metadata.shape === "string" && ["rect", "circle", "ellipse", "polygon"].includes(metadata.shape)
          ? metadata.shape as ReservationFloorObject["shape"]
          : "rect";
        const points = Array.isArray(coordinates.points)
          ? coordinates.points.flatMap((point) => {
              if (!point || typeof point !== "object") return [];
              const candidate = point as Record<string, unknown>;
              const x = toNumberOrNull(candidate.x);
              const y = toNumberOrNull(candidate.y);
              return x != null && y != null ? [{ x, y }] : [];
            })
          : [];

        return {
          id: object.id,
          venueTableId: linkedTableId,
          objectType: object.objectType,
          label: object.label,
          tableNumber: linkedTable?.tableCode ?? object.label,
          section: object.sectionName,
          capacity: object.capacity,
          minimumSpendCents: linkedTable?.minimumSpendCents ?? 0,
          reservationFeeCents: toNumberOrNull(tableMetadata.reservationFeeCents) ?? 0,
          bottleMinimumCents: toNumberOrNull(tableMetadata.bottleMinimumCents) ?? 0,
          assignedServerSection: typeof tableMetadata.serverSection === "string" ? tableMetadata.serverSection : object.sectionName,
          status: liveStatus,
          notes: typeof metadata.notes === "string" ? metadata.notes : typeof tableMetadata.notes === "string" ? tableMetadata.notes : null,
          shape,
          x: toNumberOrNull(coordinates.x) ?? 0,
          y: toNumberOrNull(coordinates.y) ?? 0,
          width: toNumberOrNull(coordinates.width) ?? 120,
          height: toNumberOrNull(coordinates.height) ?? 80,
          rotationDegrees: object.rotationDegrees,
          points,
          enabledExperienceIds: inferExperienceOptions(object.objectType, metadata).filter((item) => item.enabled).map((item) => item.id),
          customExperiences: inferExperienceOptions(object.objectType, metadata).filter((item) => item.id.startsWith("custom:")),
        } satisfies ReservationFloorObject;
      });

    const bucket = floorByVenue.get(floor.venueId) ?? [];
    bucket.push({
      id: floor.id,
      name: floor.name,
      width: floor.width,
      height: floor.height,
      backgroundImageUrl: floor.backgroundImageUrl,
      rotationDegrees: toNumberOrNull(floorMetadata.rotationDegrees) ?? 0,
      objects,
    });
    floorByVenue.set(floor.venueId, bucket);
  }

  const serversByVenue = new Map<number, ReservationServerProfile[]>();
  for (const server of serverRows) {
    const metadata = parseJsonObject(server.metadataJson);
    const bucket = serversByVenue.get(server.venueId) ?? [];
    bucket.push({
      id: server.id,
      label: server.displayName,
      subtitle: server.isLead ? "Lead server" : "Bottle server",
      photoUrl: typeof metadata.photoUrl === "string" ? metadata.photoUrl : null,
      nickname: typeof metadata.nickname === "string" ? metadata.nickname : null,
      languages: toStringArray(metadata.languages),
      bio: typeof metadata.bio === "string" ? metadata.bio : null,
      yearsEmployed: toNumberOrNull(metadata.yearsEmployed),
      rating: toNumberOrNull(metadata.rating),
      sectionAssignment: typeof metadata.sectionAssignment === "string" ? metadata.sectionAssignment : null,
      availability: typeof metadata.availability === "string" ? metadata.availability : "available",
      isLead: server.isLead,
    });
    serversByVenue.set(server.venueId, bucket);
  }

  const bottlesByVenue = new Map<number, ReservationProductOption[]>();
  for (const bottle of bottleRows) {
    const packageItems = parseJsonObject(bottle.packageItemsJson);
    const bucket = bottlesByVenue.get(bottle.venueId) ?? [];
    bucket.push({
      id: bottle.id,
      label: bottle.name,
      subtitle: bottle.description ?? "Bottle package",
      amountCents: bottle.priceCents,
      category: typeof packageItems.category === "string" ? packageItems.category : "Bottle Service",
      imageUrl: typeof packageItems.imageUrl === "string" ? packageItems.imageUrl : null,
      description: bottle.description,
      inventory: toNumberOrNull(packageItems.inventory),
      featured: toBool(packageItems.featured),
      recommended: toBool(packageItems.recommended),
      quantityLimit: toNumberOrNull(packageItems.quantityLimit),
      mixers: toStringArray(parseJsonArray(bottle.mixersJson)),
    });
    bottlesByVenue.set(bottle.venueId, bucket);
  }

  const addonsByVenue = new Map<number, ReservationProductOption[]>();
  for (const addon of addonRows) {
    const metadata = parseJsonObject(addon.metadataJson);
    const bucket = addonsByVenue.get(addon.venueId) ?? [];
    bucket.push({
      id: addon.id,
      label: addon.name,
      subtitle: addon.category,
      amountCents: addon.unitPriceCents,
      category: addon.category,
      imageUrl: typeof metadata.imageUrl === "string" ? metadata.imageUrl : null,
      description: addon.description,
      inventory: toNumberOrNull(metadata.inventory),
      featured: toBool(metadata.featured),
      recommended: toBool(metadata.recommended),
      quantityLimit: toNumberOrNull(metadata.quantityLimit),
      mixers: [],
    });
    addonsByVenue.set(addon.venueId, bucket);
  }

  return {
    venues: venueRows.map((venue) => ({
      id: venue.id,
      title: venue.name,
      subtitle: [venue.neighborhood, venue.city].filter(Boolean).join(" • "),
      imageUrl: venue.thumbnailImageUrl ?? venue.heroImageUrl ?? "/assets/nightly-fallback-image.svg",
      slug: venue.slug,
      heroImageUrl: venue.heroImageUrl,
      googleAddress: venue.googleFormattedAddress ?? null,
      googleMapsUrl: venue.googleMapsUrl ?? null,
      dressCode: venue.dressCode,
      parkingInformation: venue.parkingInformation,
      contactPhone: venue.phone,
      reservationPolicies: {
        allowDepositOnly: true,
        allowFullPayment: true,
        defaultDepositPercent: 20,
      },
      experiences: DEFAULT_EXPERIENCES,
      floors: floorByVenue.get(venue.id) ?? [],
      servers: serversByVenue.get(venue.id) ?? [],
      bottlePackages: bottlesByVenue.get(venue.id) ?? [],
      addons: addonsByVenue.get(venue.id) ?? [],
    })),
    djs: djRows.map((dj) => ({
      id: dj.id,
      title: dj.stageName,
      subtitle: [dj.city, dj.genres?.[0]].filter(Boolean).join(" • "),
      imageUrl: dj.profileImageUrl ?? "/assets/nightly-fallback-logo.svg",
      slug: dj.username,
    })),
    vipTables: vipTableRows.map((table) => ({
      id: table.id,
      label: `${table.tableCode} • ${table.name}`,
      subtitle: table.sectionName ?? "Floor",
      amountCents: table.minimumSpendCents,
    })),
    bottlePackages: bottleRows.map((bottle) => ({
      id: bottle.id,
      label: bottle.name,
      subtitle: bottle.description ?? "Bottle package",
      amountCents: bottle.priceCents,
    })),
    addons: addonRows.map((addon) => ({
      id: addon.id,
      label: addon.name,
      subtitle: addon.category,
      amountCents: addon.unitPriceCents,
    })),
    servers: serverRows.map((server) => ({
      id: server.id,
      label: server.displayName,
      subtitle: server.isLead ? "Lead server" : "Server",
      amountCents: 0,
    })),
    friends: friendRows.map((friend) => ({
      userId: friend.userId,
      clerkUserId: friend.clerkUserId,
      displayName: friend.displayName,
      handle: friend.handle,
      avatarUrl: friend.avatarUrl,
    })),
  };
}

function buildDashboardClauses(actor: BookingRoleContext) {
  if (actor.role === "admin") {
    return [];
  }

  if (actor.role === "dj" && actor.djProfileId != null) {
    return [eq(bookings.djProfileId, actor.djProfileId)];
  }

  if (actor.role === "owner" && actor.venueId != null) {
    return [eq(bookings.venueId, actor.venueId)];
  }

  return [or(eq(bookings.requesterClerkUserId, actor.clerkUserId), eq(bookings.consumerClerkUserId, actor.clerkUserId))];
}

export async function getBookingDashboardData(input: {
  actor: BookingRoleContext;
  q?: string;
  status?: BookingLifecycleStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<BookingDashboardData> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 12, 6), 48);
  const page = Math.max(input.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const filters = buildDashboardClauses(input.actor);

  if (input.status && input.status !== "all") {
    filters.push(eq(bookings.lifecycleStatus, input.status));
  }

  if (input.q?.trim()) {
    const search = `%${input.q.trim()}%`;
    filters.push(
      or(
        ilike(bookings.bookingNumber, search),
        ilike(bookings.city, search),
        ilike(bookings.notes, search),
        ilike(bookings.bookingType, search),
        ilike(venues.name, search),
        ilike(djProfiles.stageName, search)
      )
    );
  }

  const queryRows = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      bookingType: bookings.bookingType,
      lifecycleStatus: bookings.lifecycleStatus,
      city: bookings.city,
      timezone: bookings.timezone,
      requestedForAt: bookings.requestedForAt,
      requestedStartAt: bookings.requestedStartAt,
      requestedEndAt: bookings.requestedEndAt,
      guestCount: bookings.guestCount,
      budgetCents: bookings.budgetCents,
      totalCents: bookings.totalCents,
      counterOfferAmountCents: bookings.counterOfferAmountCents,
      counterOfferDepositCents: bookings.counterOfferDepositCents,
      counterOfferExpiresAt: bookings.counterOfferExpiresAt,
      depositRequiredCents: bookings.depositRequiredCents,
      payoutCents: bookings.payoutCents,
      currency: bookings.currency,
      notes: bookings.notes,
      cancellationReason: bookings.cancellationReason,
      refundReason: bookings.refundReason,
      disputeReason: bookings.disputeReason,
      consumerClerkUserId: bookings.consumerClerkUserId,
      djProfileId: bookings.djProfileId,
      djName: djProfiles.stageName,
      venueId: bookings.venueId,
      venueName: venues.name,
      venueSlug: venues.slug,
      venueHeroImageUrl: venues.heroImageUrl,
      venueGoogleAddress: venues.googleFormattedAddress,
      venueGoogleMapsUrl: venues.googleMapsUrl,
      venueDressCode: venues.dressCode,
      venueParkingInformation: venues.parkingInformation,
      venuePhone: venues.phone,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
    })
    .from(bookings)
    .leftJoin(venues, eq(bookings.venueId, venues.id))
    .leftJoin(djProfiles, eq(bookings.djProfileId, djProfiles.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(pageSize)
    .offset(offset);

  const rows: BookingDashboardRow[] = queryRows.map((row) => ({
    ...row,
    bookingType: row.bookingType as BookingType,
  }));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .leftJoin(venues, eq(bookings.venueId, venues.id))
    .leftJoin(djProfiles, eq(bookings.djProfileId, djProfiles.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  const statusRows = await db
    .select({ status: bookings.lifecycleStatus, count: sql<number>`count(*)::int` })
    .from(bookings)
    .leftJoin(venues, eq(bookings.venueId, venues.id))
    .leftJoin(djProfiles, eq(bookings.djProfileId, djProfiles.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .groupBy(bookings.lifecycleStatus);

  const counts = emptyCounts();
  for (const row of statusRows) {
    counts[row.status] = row.count;
  }

  const upcomingCount = rows.filter((row) => row.requestedStartAt && row.requestedStartAt >= new Date()).length;
  const completedCount = rows.filter((row) => row.lifecycleStatus === "completed").length;
  const cancelledCount = rows.filter((row) => row.lifecycleStatus.startsWith("cancelled")).length;

  return {
    rows,
    totalCount: countRow?.count ?? rows.length,
    counts,
    upcomingCount,
    completedCount,
    cancelledCount,
    page,
    pageSize,
    query: input.q?.trim() ?? "",
    status: input.status ?? "all",
  };
}

export async function getBookingById(bookingId: number, actor: BookingRoleContext): Promise<BookingDetailPayload> {
  const [bookingRow] = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      bookingType: bookings.bookingType,
      lifecycleStatus: bookings.lifecycleStatus,
      city: bookings.city,
      timezone: bookings.timezone,
      requestedForAt: bookings.requestedForAt,
      requestedStartAt: bookings.requestedStartAt,
      requestedEndAt: bookings.requestedEndAt,
      guestCount: bookings.guestCount,
      budgetCents: bookings.budgetCents,
      totalCents: bookings.totalCents,
      counterOfferAmountCents: bookings.counterOfferAmountCents,
      counterOfferDepositCents: bookings.counterOfferDepositCents,
      counterOfferExpiresAt: bookings.counterOfferExpiresAt,
      depositRequiredCents: bookings.depositRequiredCents,
      payoutCents: bookings.payoutCents,
      currency: bookings.currency,
      notes: bookings.notes,
      cancellationReason: bookings.cancellationReason,
      refundReason: bookings.refundReason,
      disputeReason: bookings.disputeReason,
      consumerClerkUserId: bookings.consumerClerkUserId,
      djProfileId: bookings.djProfileId,
      djName: djProfiles.stageName,
      venueId: bookings.venueId,
      venueName: venues.name,
      venueSlug: venues.slug,
      venueHeroImageUrl: venues.heroImageUrl,
      venueGoogleAddress: venues.googleFormattedAddress,
      venueGoogleMapsUrl: venues.googleMapsUrl,
      venueDressCode: venues.dressCode,
      venueParkingInformation: venues.parkingInformation,
      venuePhone: venues.phone,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
    })
    .from(bookings)
    .leftJoin(venues, eq(bookings.venueId, venues.id))
    .leftJoin(djProfiles, eq(bookings.djProfileId, djProfiles.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const booking = bookingRow
    ? ({
        ...bookingRow,
        bookingType: bookingRow.bookingType as BookingType,
      } satisfies BookingDashboardRow)
    : null;

  if (!booking) {
    return {
      booking: null,
      participants: [],
      messages: [],
      history: [],
      attachments: [],
      payments: [],
      refunds: [],
      disputes: [],
      reviews: [],
      notifications: [],
      contracts: [],
      contractVersions: [],
      pricing: [],
      discounts: [],
      couponUsage: [],
      requirements: [],
      checkin: [],
      auditLog: [],
      tableBooking: null,
      bookingItems: [],
      bottleSelections: [],
      addonSelections: [],
      billSplits: [],
      activity: [],
      isAccessible: false,
    };
  }

  const bookingDetail: BookingDashboardRow = {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    bookingType: booking.bookingType as BookingType,
    lifecycleStatus: booking.lifecycleStatus,
    city: booking.city,
    timezone: booking.timezone,
    requestedForAt: booking.requestedForAt,
    requestedStartAt: booking.requestedStartAt,
    requestedEndAt: booking.requestedEndAt,
    guestCount: booking.guestCount,
    budgetCents: booking.budgetCents,
    totalCents: booking.totalCents,
    counterOfferAmountCents: booking.counterOfferAmountCents,
    counterOfferDepositCents: booking.counterOfferDepositCents,
    counterOfferExpiresAt: booking.counterOfferExpiresAt,
    depositRequiredCents: booking.depositRequiredCents,
    payoutCents: booking.payoutCents,
    currency: booking.currency,
    notes: booking.notes,
    cancellationReason: booking.cancellationReason,
    refundReason: booking.refundReason,
    disputeReason: booking.disputeReason,
    consumerClerkUserId: booking.consumerClerkUserId,
    djProfileId: booking.djProfileId,
    djName: booking.djName,
    venueId: booking.venueId,
    venueName: booking.venueName,
    venueSlug: booking.venueSlug,
    venueHeroImageUrl: booking.venueHeroImageUrl,
    venueGoogleAddress: booking.venueGoogleAddress,
    venueGoogleMapsUrl: booking.venueGoogleMapsUrl,
    venueDressCode: booking.venueDressCode,
    venueParkingInformation: booking.venueParkingInformation,
    venuePhone: booking.venuePhone,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };

  const isAccessible = canViewBooking(
    {
      requesterClerkUserId: booking.consumerClerkUserId,
      consumerClerkUserId: booking.consumerClerkUserId,
      djProfileId: booking.djProfileId,
      venueId: booking.venueId,
    },
    actor
  );

  if (!isAccessible) {
    return {
      booking: null,
      participants: [],
      messages: [],
      history: [],
      attachments: [],
      payments: [],
      refunds: [],
      disputes: [],
      reviews: [],
      notifications: [],
      contracts: [],
      contractVersions: [],
      pricing: [],
      discounts: [],
      couponUsage: [],
      requirements: [],
      checkin: [],
      auditLog: [],
      tableBooking: null,
      bookingItems: [],
      bottleSelections: [],
      addonSelections: [],
      billSplits: [],
      activity: [],
      isAccessible: false,
    };
  }

  const [participants, messages, history, attachments, payments, refunds, disputes, reviews, notifications, contracts, contractVersions, pricing, discounts, couponUsage, requirements, checkin, auditLog, tableBookingRows, itemRows, bottleRows, addonRows, splitRows, activityRows] = await Promise.all([
    db.select().from(bookingParticipants).where(eq(bookingParticipants.bookingId, bookingId)).orderBy(asc(bookingParticipants.createdAt)),
    db.select().from(bookingMessages).where(eq(bookingMessages.bookingId, bookingId)).orderBy(desc(bookingMessages.createdAt), desc(bookingMessages.id)).limit(40),
    db.select().from(bookingStatusHistory).where(eq(bookingStatusHistory.bookingId, bookingId)).orderBy(desc(bookingStatusHistory.createdAt), desc(bookingStatusHistory.id)).limit(60),
    db.select().from(bookingAttachments).where(eq(bookingAttachments.bookingId, bookingId)).orderBy(desc(bookingAttachments.createdAt), desc(bookingAttachments.id)).limit(40),
    db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, bookingId)).orderBy(desc(bookingPayments.createdAt), desc(bookingPayments.id)).limit(20),
    db.select().from(bookingRefunds).where(eq(bookingRefunds.bookingId, bookingId)).orderBy(desc(bookingRefunds.createdAt), desc(bookingRefunds.id)).limit(20),
    db.select().from(bookingDisputes).where(eq(bookingDisputes.bookingId, bookingId)).orderBy(desc(bookingDisputes.createdAt), desc(bookingDisputes.id)).limit(20),
    db.select().from(bookingReviews).where(eq(bookingReviews.bookingId, bookingId)).orderBy(desc(bookingReviews.createdAt), desc(bookingReviews.id)).limit(20),
    db.select().from(bookingNotifications).where(eq(bookingNotifications.bookingId, bookingId)).orderBy(desc(bookingNotifications.createdAt), desc(bookingNotifications.id)).limit(40),
    db.select().from(bookingContracts).where(eq(bookingContracts.bookingId, bookingId)).orderBy(desc(bookingContracts.updatedAt), desc(bookingContracts.id)).limit(1),
    db
      .select({
        id: bookingContractVersions.id,
        versionNumber: bookingContractVersions.versionNumber,
        contentJson: bookingContractVersions.contentJson,
        createdByClerkUserId: bookingContractVersions.createdByClerkUserId,
        createdAt: bookingContractVersions.createdAt,
      })
      .from(bookingContractVersions)
      .innerJoin(bookingContracts, eq(bookingContractVersions.bookingContractId, bookingContracts.id))
      .where(eq(bookingContracts.bookingId, bookingId))
      .orderBy(desc(bookingContractVersions.versionNumber), desc(bookingContractVersions.createdAt))
      .limit(20),
    db.select().from(bookingPricing).where(eq(bookingPricing.bookingId, bookingId)).orderBy(desc(bookingPricing.quoteVersion), desc(bookingPricing.createdAt)).limit(20),
    db.select().from(bookingDiscounts).where(eq(bookingDiscounts.bookingId, bookingId)).orderBy(desc(bookingDiscounts.createdAt), desc(bookingDiscounts.id)).limit(20),
    db.select().from(bookingCouponUsage).where(eq(bookingCouponUsage.bookingId, bookingId)).orderBy(desc(bookingCouponUsage.createdAt), desc(bookingCouponUsage.id)).limit(20),
    db.select().from(bookingRequirements).where(eq(bookingRequirements.bookingId, bookingId)).orderBy(desc(bookingRequirements.updatedAt), desc(bookingRequirements.id)).limit(20),
    db.select().from(bookingCheckins).where(eq(bookingCheckins.bookingId, bookingId)).limit(1),
    db.select().from(bookingAuditLog).where(eq(bookingAuditLog.bookingId, bookingId)).orderBy(desc(bookingAuditLog.createdAt), desc(bookingAuditLog.id)).limit(40),
    db
      .select({
        id: tableBookings.id,
        venueTableId: tableBookings.venueTableId,
        tableName: venueTables.name,
        serverId: tableBookings.serverId,
        serverName: venueServers.displayName,
        bookingCategory: tableBookings.bookingCategory,
        reservationName: tableBookings.reservationName,
        partySize: tableBookings.partySize,
        reservationStartAt: tableBookings.reservationStartAt,
        reservationEndAt: tableBookings.reservationEndAt,
        status: tableBookings.status,
        minimumSpendCents: tableBookings.minimumSpendCents,
        depositAmountCents: tableBookings.depositAmountCents,
        notes: tableBookings.notes,
        metadataJson: tableBookings.metadataJson,
      })
      .from(tableBookings)
      .leftJoin(venueTables, eq(tableBookings.venueTableId, venueTables.id))
      .leftJoin(venueServers, eq(tableBookings.serverId, venueServers.id))
      .where(eq(tableBookings.bookingId, bookingId))
      .limit(1),
    db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId)).orderBy(asc(bookingItems.id)).limit(60),
    db.select().from(bookingBottles).where(eq(bookingBottles.bookingId, bookingId)).orderBy(asc(bookingBottles.id)).limit(40),
    db.select().from(bookingAddons).where(eq(bookingAddons.bookingId, bookingId)).orderBy(asc(bookingAddons.id)).limit(40),
    db.select().from(billSplits).where(eq(billSplits.bookingId, bookingId)).orderBy(asc(billSplits.id)).limit(20),
    db.select().from(bookingActivity).where(eq(bookingActivity.bookingId, bookingId)).orderBy(desc(bookingActivity.createdAt), desc(bookingActivity.id)).limit(80),
  ]);

  const tableBooking = tableBookingRows[0] ?? null;

  return {
    booking: bookingDetail,
    participants: participants.map((participant) => ({
      id: participant.id,
      participantRole: participant.participantRole,
      clerkUserId: participant.clerkUserId,
      displayName: participant.displayName,
      email: participant.email,
      isPrimary: participant.isPrimary,
      responseStatus: participant.responseStatus,
    })),
    messages: messages.map((message) => ({
      id: message.id,
      senderRole: message.senderRole,
      senderClerkUserId: message.senderClerkUserId,
      messageType: message.messageType,
      body: message.body,
      isSystem: message.isSystem,
      readAt: message.readAt,
      createdAt: message.createdAt,
    })),
    history: history.map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      actorClerkUserId: row.actorClerkUserId,
      actorRole: row.actorRole,
      note: row.note,
      createdAt: row.createdAt,
    })),
    attachments: attachments.map((row) => ({
      id: row.id,
      attachmentKind: row.attachmentKind,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      thumbnailUrl: row.thumbnailUrl,
      mimeType: row.mimeType,
      messageId: row.messageId,
    })),
    payments: payments.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      amountCents: row.amountCents,
      currency: row.currency,
      providerInvoiceId: row.providerInvoiceId,
      providerReceiptUrl: row.providerReceiptUrl,
      paidAt: row.paidAt,
      refundedAt: row.refundedAt,
      createdAt: row.createdAt,
    })),
    refunds: refunds.map((row) => ({
      id: row.id,
      amountCents: row.amountCents,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requestedAt,
      processedAt: row.processedAt,
    })),
    disputes: disputes.map((row) => ({
      id: row.id,
      subject: row.subject,
      reason: row.reason,
      status: row.status,
      adminNotes: row.adminNotes,
      resolvedAt: row.resolvedAt,
    })),
    reviews: reviews.map((row) => ({
      id: row.id,
      subjectType: row.subjectType,
      rating: row.rating,
      title: row.title,
      body: row.body,
      privateAdminNotes: row.privateAdminNotes,
      createdAt: row.createdAt,
    })),
    notifications: notifications.map((row) => ({
      id: row.id,
      notificationType: row.notificationType,
      recipientClerkUserId: row.recipientClerkUserId,
      status: row.status,
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt,
    })),
    contracts: contracts.map((row) => ({
      id: row.id,
      versionNumber: row.versionNumber,
      status: row.status,
      title: row.title,
      termsJson: row.termsJson,
      acceptanceJson: row.acceptanceJson,
      generatedAt: row.generatedAt,
      sentAt: row.sentAt,
      acceptedAt: row.acceptedAt,
      signedAt: row.signedAt,
    })),
    contractVersions: contractVersions.map((row) => ({
      id: row.id,
      versionNumber: row.versionNumber,
      contentJson: row.contentJson,
      createdByClerkUserId: row.createdByClerkUserId,
      createdAt: row.createdAt,
    })),
    pricing: pricing.map((row) => ({
      id: row.id,
      pricingKind: row.pricingKind,
      quoteVersion: row.quoteVersion,
      baseAmountCents: row.baseAmountCents,
      depositAmountCents: row.depositAmountCents,
      serviceFeeCents: row.serviceFeeCents,
      taxCents: row.taxCents,
      platformFeeCents: row.platformFeeCents,
      travelFeeCents: row.travelFeeCents,
      surgeFeeCents: row.surgeFeeCents,
      discountCents: row.discountCents,
      totalAmountCents: row.totalAmountCents,
      currency: row.currency,
      quoteExpiresAt: row.quoteExpiresAt,
      quoteNotes: row.quoteNotes,
    })),
    discounts: discounts.map((row) => ({
      id: row.id,
      discountCode: row.discountCode,
      discountKind: row.discountKind,
      percentOff: row.percentOff,
      amountOffCents: row.amountOffCents,
      description: row.description,
    })),
    couponUsage: couponUsage.map((row) => ({
      id: row.id,
      couponCode: row.couponCode,
      discountKind: row.discountKind,
      discountCents: row.discountCents,
    })),
    requirements: requirements.map((row) => ({
      id: row.id,
      requirementType: row.requirementType,
      title: row.title,
      details: row.details,
      isRequired: row.isRequired,
      isMet: row.isMet,
      status: row.status,
    })),
    checkin: checkin.map((row) => ({
      id: row.id,
      status: row.status,
      checkedInAt: row.checkedInAt,
      checkedInByClerkUserId: row.checkedInByClerkUserId,
      method: row.method,
      notes: row.notes,
    })),
    auditLog: auditLog.map((row) => ({
      id: row.id,
      action: row.action,
      actorClerkUserId: row.actorClerkUserId,
      actorRole: row.actorRole,
      metadataJson: row.metadataJson,
      createdAt: row.createdAt,
    })),
    tableBooking: tableBooking
      ? {
          id: tableBooking.id,
          venueTableId: tableBooking.venueTableId,
          tableName: tableBooking.tableName,
          serverId: tableBooking.serverId,
          serverName: tableBooking.serverName,
          bookingCategory: tableBooking.bookingCategory,
          reservationName: tableBooking.reservationName,
          partySize: tableBooking.partySize,
          reservationStartAt: tableBooking.reservationStartAt,
          reservationEndAt: tableBooking.reservationEndAt,
          status: tableBooking.status,
          minimumSpendCents: tableBooking.minimumSpendCents,
          depositAmountCents: tableBooking.depositAmountCents,
          notes: tableBooking.notes,
          metadataJson: tableBooking.metadataJson,
        }
      : null,
    bookingItems: itemRows.map((row) => ({
      id: row.id,
      itemType: row.itemType,
      label: row.label,
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      totalPriceCents: row.totalPriceCents,
    })),
    bottleSelections: bottleRows.map((row) => ({
      id: row.id,
      bottlePackageId: row.bottlePackageId,
      label: row.label,
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      notes: row.notes,
    })),
    addonSelections: addonRows.map((row) => ({
      id: row.id,
      venueAddonId: row.venueAddonId,
      label: row.label,
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      totalPriceCents: row.totalPriceCents,
      notes: row.notes,
    })),
    billSplits: splitRows.map((row) => ({
      id: row.id,
      payerDisplayName: row.payerDisplayName,
      payerEmail: row.payerEmail,
      splitPercent: row.splitPercent,
      amountCents: row.amountCents,
      status: row.status,
      paidAt: row.paidAt,
    })),
    activity: activityRows.map((row) => ({
      id: row.id,
      activityType: row.activityType,
      details: row.details,
      actorRole: row.actorRole,
      createdAt: row.createdAt,
    })),
    isAccessible: true,
  };
}
