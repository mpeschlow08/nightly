import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import {
  venueClaimRequests,
  venueMembers,
  venues,
} from "@/db/schema";

import { searchGooglePlacesVenues } from "./google-places";

export type ClaimableVenueResult = {
  source: "imported" | "google";
  venueId: number | null;
  googlePlaceId: string | null;
  photoUrl: string | null;
  name: string;
  address: string;
  category: string | null;
  status: "claimed" | "unclaimed" | "pending";
};

function parseVenueCategory(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      const first = parsed.find((item) => typeof item === "string" && item.trim().length > 0);
      return typeof first === "string" ? first.trim() : null;
    }
  } catch {
    return null;
  }

  return null;
}

function buildStatus(membershipCount: number, pendingClaimCount: number): "claimed" | "unclaimed" | "pending" {
  if (membershipCount > 0) {
    return "claimed";
  }

  if (pendingClaimCount > 0) {
    return "pending";
  }

  return "unclaimed";
}

export async function getOwnerClaimRequests(clerkUserId: string) {
  return db
    .select({
      id: venueClaimRequests.id,
      venueId: venueClaimRequests.venueId,
      venueName: venueClaimRequests.venueName,
      venueAddress: venueClaimRequests.venueAddress,
      venueCategory: venueClaimRequests.venueCategory,
      status: venueClaimRequests.status,
      createdAt: venueClaimRequests.createdAt,
      reviewedAt: venueClaimRequests.reviewedAt,
      adminNotes: venueClaimRequests.adminNotes,
    })
    .from(venueClaimRequests)
    .where(eq(venueClaimRequests.claimantClerkUserId, clerkUserId))
    .orderBy(desc(venueClaimRequests.createdAt));
}

export async function searchClaimableVenues(query: string) {
  const normalized = query.trim();

  if (!normalized) {
    return [] as ClaimableVenueResult[];
  }

  const importedRows = await db
    .select({
      id: venues.id,
      googlePlaceId: venues.googlePlaceId,
      name: venues.name,
      address: venues.address,
      city: venues.city,
      heroImageUrl: venues.heroImageUrl,
      venueCategoriesJson: venues.venueCategoriesJson,
      memberCount: sql<number>`(
        select count(*)::int from ${venueMembers} m where m.venue_id = ${venues.id}
      )`,
      pendingClaimCount: sql<number>`(
        select count(*)::int from ${venueClaimRequests} c
        where c.venue_id = ${venues.id} and c.status = 'pending'
      )`,
    })
    .from(venues)
    .where(
      or(
        ilike(venues.name, `%${normalized}%`),
        ilike(venues.address, `%${normalized}%`),
        ilike(venues.city, `%${normalized}%`),
        ilike(venues.googlePlaceId, `%${normalized}%`)
      )
    )
    .limit(12);

  const imported = importedRows.map((row) => ({
    source: "imported" as const,
    venueId: row.id,
    googlePlaceId: row.googlePlaceId,
    photoUrl: row.heroImageUrl,
    name: row.name,
    address: row.address?.trim() || row.city?.trim() || "Address unavailable",
    category: parseVenueCategory(row.venueCategoriesJson),
    status: buildStatus(row.memberCount ?? 0, row.pendingClaimCount ?? 0),
  }));

  let googleMatches: ClaimableVenueResult[] = [];

  try {
    const externalResults = await searchGooglePlacesVenues({ query: normalized });

    googleMatches = externalResults
      .filter((row) => !imported.some((item) => item.googlePlaceId && item.googlePlaceId === row.placeId))
      .map((row) => ({
        source: "google" as const,
        venueId: null,
        googlePlaceId: row.placeId,
        photoUrl: null,
        name: row.displayName,
        address: row.formattedAddress,
        category: null,
        status: "unclaimed" as const,
      }));
  } catch {
    googleMatches = [];
  }

  return [...imported, ...googleMatches].slice(0, 20);
}

export async function ensureNoDuplicateClaimRequest(input: {
  claimantClerkUserId: string;
  venueId: number | null;
  googlePlaceId: string | null;
}) {
  const duplicate = await db.query.venueClaimRequests.findFirst({
    where: and(
      eq(venueClaimRequests.claimantClerkUserId, input.claimantClerkUserId),
      input.venueId != null
        ? eq(venueClaimRequests.venueId, input.venueId)
        : input.googlePlaceId
          ? eq(venueClaimRequests.googlePlaceId, input.googlePlaceId)
          : sql`false`,
      or(
        eq(venueClaimRequests.status, "pending"),
        eq(venueClaimRequests.status, "approved"),
        eq(venueClaimRequests.status, "claimed")
      )
    ),
    columns: { id: true },
  });

  if (duplicate) {
    throw new Error("A claim request for this venue is already in progress for your account.");
  }

  if (input.venueId != null || input.googlePlaceId) {
    const globalDuplicate = await db.query.venueClaimRequests.findFirst({
      where: and(
        input.venueId != null
          ? eq(venueClaimRequests.venueId, input.venueId)
          : eq(venueClaimRequests.googlePlaceId, input.googlePlaceId as string),
        eq(venueClaimRequests.status, "pending")
      ),
      columns: { id: true },
    });

    if (globalDuplicate) {
      throw new Error("This venue already has a pending claim request under review.");
    }
  }

  if (input.venueId != null) {
    const existingMembership = await db.query.venueMembers.findFirst({
      where: and(
        eq(venueMembers.venueId, input.venueId),
        eq(venueMembers.clerkUserId, input.claimantClerkUserId)
      ),
      columns: { id: true },
    });

    if (existingMembership) {
      throw new Error("You already have access to this venue.");
    }
  }
}

export async function createClaimRequest(input: {
  claimantClerkUserId: string;
  claimantRole: string;
  venueId: number | null;
  googlePlaceId: string | null;
  venueName: string;
  venueAddress: string;
  venueCategory: string | null;
  businessEmail: string;
  businessPhone: string;
  websiteUrl: string | null;
  notes: string | null;
}) {
  await ensureNoDuplicateClaimRequest({
    claimantClerkUserId: input.claimantClerkUserId,
    venueId: input.venueId,
    googlePlaceId: input.googlePlaceId,
  });

  const [row] = await db
    .insert(venueClaimRequests)
    .values({
      venueId: input.venueId,
      claimantClerkUserId: input.claimantClerkUserId,
      claimantRole: input.claimantRole,
      businessEmail: input.businessEmail,
      businessPhone: input.businessPhone,
      websiteUrl: input.websiteUrl,
      notes: input.notes,
      venueName: input.venueName,
      venueAddress: input.venueAddress,
      venueCategory: input.venueCategory,
      googlePlaceId: input.googlePlaceId,
      status: "pending",
    })
    .returning({ id: venueClaimRequests.id });

  await writeAuditLog({
    actorClerkUserId: input.claimantClerkUserId,
    actorRole: input.claimantRole,
    entityType: "venue_claim_request",
    entityId: row.id,
    action: "claim_request_created",
    nextValues: {
      venueId: input.venueId,
      venueName: input.venueName,
      googlePlaceId: input.googlePlaceId,
      status: "pending",
    },
  });

  return row.id;
}
