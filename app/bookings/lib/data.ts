import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bookingAuditLog,
  bookingAttachments,
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
  bookingStatusHistory,
  bookings,
  djProfiles,
  venues,
  bookingRefunds,
} from "@/db/schema";
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
  venues: BookingRequestOption[];
  djs: BookingRequestOption[];
};

function emptyCounts() {
  return BOOKING_LIFECYCLE_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = 0;
    return accumulator;
  }, {} as Record<BookingLifecycleStatus, number>);
}

export async function getBookingRequestOptions(): Promise<BookingRequestOptions> {
  const [venueRows, djRows] = await Promise.all([
    db
      .select({
        id: venues.id,
        name: venues.name,
        slug: venues.slug,
        city: venues.city,
        neighborhood: venues.neighborhood,
        heroImageUrl: venues.heroImageUrl,
        thumbnailImageUrl: venues.thumbnailImageUrl,
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
  ]);

  return {
    venues: venueRows.map((venue) => ({
      id: venue.id,
      title: venue.name,
      subtitle: [venue.neighborhood, venue.city].filter(Boolean).join(" • "),
      imageUrl: venue.thumbnailImageUrl ?? venue.heroImageUrl ?? "/assets/nightly-fallback-image.svg",
      slug: venue.slug,
    })),
    djs: djRows.map((dj) => ({
      id: dj.id,
      title: dj.stageName,
      subtitle: [dj.city, dj.genres?.[0]].filter(Boolean).join(" • "),
      imageUrl: dj.profileImageUrl ?? "/assets/nightly-fallback-logo.svg",
      slug: dj.username,
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
      isAccessible: false,
    };
  }

  const [participants, messages, history, attachments, payments, refunds, disputes, reviews, notifications, contracts, contractVersions, pricing, discounts, couponUsage, requirements, checkin, auditLog] = await Promise.all([
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
  ]);

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
    isAccessible: true,
  };
}
