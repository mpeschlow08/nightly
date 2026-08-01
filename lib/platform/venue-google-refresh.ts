import { randomUUID } from "node:crypto";

import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, notInArray, or } from "drizzle-orm";

import {
  GooglePlacesRequestError,
  type GooglePlacesFailureClassification,
  getGooglePlaceVenueDetails,
} from "@/app/owner/lib/google-places";
import {
  STALE_REFRESH_BLOCKED_STATUSES,
  classifyRefreshStatusFromFailure,
} from "@/lib/platform/venue-google-refresh-classification";
import { db } from "@/db";
import {
  platformJobLocks,
  platformJobRuns,
  platformJobs,
  venueDataRefreshItems,
  venueDataRefreshRuns,
  venueGooglePhotoMetadata,
  venues,
} from "@/db/schema";

const VENUE_GOOGLE_REFRESH_JOB_KEY = "venue_google_data_refresh";
const VENUE_GOOGLE_REFRESH_VERSION = "v1";
const GOOGLE_HIGH_CHANGE_TTL_MS = 1000 * 60 * 60 * 8;
const GOOGLE_MEDIUM_CHANGE_TTL_MS = 1000 * 60 * 60 * 24;
const GOOGLE_LOW_CHANGE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const GOOGLE_PHOTO_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BATCH = 100;

export type VenueRefreshMode = "single" | "batch" | "stale_only" | "failed_only";

export type VenueGoogleRefreshOptions = {
  mode: VenueRefreshMode;
  venueId?: number;
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  trigger?: "manual" | "scheduled" | "admin" | "owner" | "script";
  requestedByClerkUserId?: string | null;
  correlationId?: string;
};

export type VenueGoogleRefreshSummary = {
  runId: number;
  mode: VenueRefreshMode;
  status: "queued" | "running" | "succeeded" | "failed";
  dryRun: boolean;
  force: boolean;
  selectedVenueCount: number;
  processedVenueCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  requestCount: number;
  schedulerState: "configured" | "not_configured";
  details: Array<{
    venueId: number;
    status: "success" | "skipped" | "failed";
    requestCount: number;
    changedFields: string[];
    errorMessage: string | null;
    failureClassification: GooglePlacesFailureClassification | null;
    retryable: boolean | null;
    providerHttpStatus: number | null;
    providerStatusCode: string | null;
    fieldMaskProfile: string | null;
    correlationId: string | null;
  }>;
};

function formatSafeFailureMessage(error: GooglePlacesRequestError) {
  const providerStatus = error.diagnostic.providerStatus ?? "UNKNOWN";
  const providerMessage = error.diagnostic.providerMessage ?? "Provider request failed.";
  return `[${error.diagnostic.classification}] ${providerStatus}: ${providerMessage}`;
}

function parseOverrideFields(raw: string | null | undefined) {
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    );
  } catch {
    return new Set<string>();
  }
}

function shouldWriteOwnerManagedField(overrides: Set<string>, fieldName: string) {
  return !overrides.has(fieldName);
}

function sanitizeLimit(input: number | undefined) {
  if (!input || !Number.isFinite(input)) {
    return 25;
  }

  return Math.max(1, Math.min(Math.trunc(input), MAX_BATCH));
}

async function ensurePlatformJobRecord() {
  const existing = await db.query.platformJobs.findFirst({
    where: eq(platformJobs.jobKey, VENUE_GOOGLE_REFRESH_JOB_KEY),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(platformJobs)
    .values({
      jobKey: VENUE_GOOGLE_REFRESH_JOB_KEY,
      label: "Venue Google Data Refresh",
      description:
        "Refreshes mapped venue records from Google Places using stale-aware field masks and ownership-safe writes.",
      status: "enabled",
      supportsDryRun: true,
      adapterReady: false,
      scheduleCron: null,
    })
    .returning();

  return created;
}

async function acquireLock(correlationId: string) {
  const now = new Date();

  const activeLock = await db.query.platformJobLocks.findFirst({
    where: and(
      eq(platformJobLocks.jobKey, VENUE_GOOGLE_REFRESH_JOB_KEY),
      isNull(platformJobLocks.releasedAt),
      or(isNull(platformJobLocks.expiresAt), gte(platformJobLocks.expiresAt, now))
    ),
  });

  if (activeLock) {
    return null;
  }

  const [lock] = await db
    .insert(platformJobLocks)
    .values({
      jobKey: VENUE_GOOGLE_REFRESH_JOB_KEY,
      lockToken: randomUUID(),
      correlationId,
      expiresAt: new Date(now.getTime() + 1000 * 60 * 10),
      metadataJson: JSON.stringify({ reason: "venue_google_refresh" }),
    })
    .returning();

  return lock;
}

async function releaseLock(lockId: number) {
  await db
    .update(platformJobLocks)
    .set({
      releasedAt: new Date(),
      releasedBy: "venue_google_refresh",
    })
    .where(eq(platformJobLocks.id, lockId));
}

async function selectVenueIdsForMode(options: VenueGoogleRefreshOptions) {
  const limit = sanitizeLimit(options.limit);

  if (options.mode === "single") {
    if (!options.venueId || !Number.isFinite(options.venueId)) {
      throw new Error("A valid venue ID is required for single refresh mode.");
    }

    return [options.venueId];
  }

  if (options.mode === "failed_only") {
    const rows = await db
      .select({ id: venues.id })
      .from(venues)
      .where(isNotNull(venues.googleRefreshError))
      .orderBy(asc(venues.id))
      .limit(limit);

    return rows.map((row) => row.id);
  }

  if (options.mode === "stale_only") {
    const now = new Date();
    const whereConditions = [
      isNotNull(venues.googlePlaceId),
      or(isNull(venues.googleDataExpiresAt), lte(venues.googleDataExpiresAt, now)),
      isNull(venues.googleRefreshSuspendedAt),
    ];

    if (!options.force) {
      whereConditions.push(notInArray(venues.googleRefreshStatus, STALE_REFRESH_BLOCKED_STATUSES));
    }

    const rows = await db
      .select({ id: venues.id })
      .from(venues)
      .where(and(...whereConditions))
      .orderBy(asc(venues.id))
      .limit(limit);

    return rows.map((row) => row.id);
  }

  const rows = await db
    .select({ id: venues.id })
    .from(venues)
    .where(and(isNotNull(venues.googlePlaceId), isNull(venues.googleRefreshSuspendedAt)))
    .orderBy(asc(venues.id))
    .limit(limit);

  return rows.map((row) => row.id);
}

function mapRefreshModeToTrigger(
  requested: VenueGoogleRefreshOptions["trigger"]
): "manual" | "scheduled" | "api" {
  if (requested === "scheduled") {
    return "scheduled";
  }

  if (requested === "script") {
    return "api";
  }

  return "manual";
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function getSchedulerState() {
  return process.env.JOB_SCHEDULER_PROVIDER?.trim()
    ? ("configured" as const)
    : ("not_configured" as const);
}

export async function estimateVenueRefreshRequestCount(
  options: Pick<VenueGoogleRefreshOptions, "mode" | "venueId" | "limit">
) {
  const ids = await selectVenueIdsForMode({
    mode: options.mode,
    venueId: options.venueId,
    limit: options.limit,
  });

  return {
    selectedVenueCount: ids.length,
    estimatedRequests: ids.length,
  };
}

export async function runVenueGoogleDataRefresh(
  options: VenueGoogleRefreshOptions
): Promise<VenueGoogleRefreshSummary> {
  const correlationId = options.correlationId ?? randomUUID();
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);

  const platformJob = await ensurePlatformJobRecord();
  const lock = await acquireLock(correlationId);

  if (!lock) {
    throw new Error("A venue Google refresh run is already in progress.");
  }

  const selectedVenueIds = await selectVenueIdsForMode(options);
  const schedulerState = getSchedulerState();

  const [runRecord] = await db
    .insert(venueDataRefreshRuns)
    .values({
      trigger: options.trigger ?? "manual",
      status: "running",
      dryRun,
      force,
      requestedByClerkUserId: options.requestedByClerkUserId ?? null,
      correlationId,
      requestEstimateCount: selectedVenueIds.length,
      selectedVenueCount: selectedVenueIds.length,
      startedAt: new Date(),
      metadataJson: toJson({ mode: options.mode, schedulerState }),
    })
    .returning();

  const [jobRun] = await db
    .insert(platformJobRuns)
    .values({
      jobId: platformJob.id,
      status: "running",
      trigger: mapRefreshModeToTrigger(options.trigger),
      idempotencyKey: `${VENUE_GOOGLE_REFRESH_JOB_KEY}:${correlationId}`,
      startedAt: new Date(),
      attempts: 1,
      metadataJson: toJson({ runId: runRecord.id, mode: options.mode, dryRun, force }),
    })
    .returning();

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let requestCount = 0;

  const details: VenueGoogleRefreshSummary["details"] = [];

  try {
    if (selectedVenueIds.length > 0) {
      await db.insert(venueDataRefreshItems).values(
        selectedVenueIds.map((venueId) => ({
          runId: runRecord.id,
          venueId,
          status: "queued",
        }))
      );
    }

    const rows =
      selectedVenueIds.length > 0
        ? await db.select().from(venues).where(inArray(venues.id, selectedVenueIds))
        : [];

    for (const venue of rows) {
      const item = await db.query.venueDataRefreshItems.findFirst({
        where: and(eq(venueDataRefreshItems.runId, runRecord.id), eq(venueDataRefreshItems.venueId, venue.id)),
      });

      if (!item) {
        continue;
      }

      await db
        .update(venueDataRefreshItems)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(venueDataRefreshItems.id, item.id));

      if (!venue.googlePlaceId) {
        skippedCount += 1;
        details.push({
          venueId: venue.id,
          status: "skipped",
          requestCount: 0,
          changedFields: [],
          errorMessage: "Venue has no Google Place ID.",
          failureClassification: null,
          retryable: null,
          providerHttpStatus: null,
          providerStatusCode: null,
          fieldMaskProfile: null,
          correlationId,
        });

        await db
          .update(venueDataRefreshItems)
          .set({
            status: "skipped",
            requestCount: 0,
            errorMessage: "Venue has no Google Place ID.",
            finishedAt: new Date(),
          })
          .where(eq(venueDataRefreshItems.id, item.id));

        continue;
      }

      try {
        const now = new Date();
        const currentExpiresAt = venue.googleDataExpiresAt;
        const staleByTime = !currentExpiresAt || currentExpiresAt.getTime() <= now.getTime();

        if (!force && !staleByTime && options.mode === "stale_only") {
          skippedCount += 1;
          details.push({
            venueId: venue.id,
            status: "skipped",
            requestCount: 0,
            changedFields: [],
            errorMessage: "Venue is not stale.",
            failureClassification: null,
            retryable: null,
            providerHttpStatus: null,
            providerStatusCode: null,
            fieldMaskProfile: null,
            correlationId,
          });

          await db
            .update(venueDataRefreshItems)
            .set({
              status: "skipped",
              requestCount: 0,
              errorMessage: "Venue is not stale.",
              finishedAt: new Date(),
            })
            .where(eq(venueDataRefreshItems.id, item.id));

          continue;
        }

        requestCount += 1;
        const detailsPayload = await getGooglePlaceVenueDetails(venue.googlePlaceId, {
          correlationId,
        });

        const ownerOverrides = parseOverrideFields(venue.ownerOverrideFieldsJson);
        const changedFields: string[] = [];

        const nextDataExpiresAt = new Date(
          now.getTime() + Math.min(GOOGLE_LOW_CHANGE_TTL_MS, GOOGLE_PHOTO_TTL_MS)
        );
        const nextAddressExpiresAt = new Date(now.getTime() + GOOGLE_LOW_CHANGE_TTL_MS);
        const nextOperationalExpiresAt = new Date(now.getTime() + GOOGLE_HIGH_CHANGE_TTL_MS);
        const nextMediumExpiresAt = new Date(now.getTime() + GOOGLE_MEDIUM_CHANGE_TTL_MS);
        const resolvedExpiresAt =
          venue.googleDataExpiresAt && venue.googleDataExpiresAt.getTime() > nextMediumExpiresAt.getTime()
            ? venue.googleDataExpiresAt
            : nextMediumExpiresAt;

        const nextVenuePatch: Partial<typeof venues.$inferInsert> = {
          googlePlaceId: detailsPayload.placeId,
          googlePlaceResourceName: detailsPayload.googleResourceName,
          googleBusinessStatus: detailsPayload.businessStatus,
          googlePrimaryType: detailsPayload.primaryType,
          googleTypesJson: JSON.stringify(detailsPayload.types),
          googleDisplayName: detailsPayload.displayName,
          googleFormattedAddress: detailsPayload.formattedAddress,
          googleNationalPhoneNumber: detailsPayload.nationalPhoneNumber,
          googleInternationalPhoneNumber: detailsPayload.internationalPhoneNumber,
          googleWebsiteUri: detailsPayload.websiteUri,
          googleMapsUri: detailsPayload.googleMapsUri,
          googleRegularOpeningHoursJson: detailsPayload.regularOpeningHours
            ? JSON.stringify(detailsPayload.regularOpeningHours)
            : null,
          googleCurrentOpeningHoursJson: detailsPayload.currentOpeningHours
            ? JSON.stringify(detailsPayload.currentOpeningHours)
            : null,
          googleUtcOffsetMinutes:
            typeof detailsPayload.utcOffsetMinutes === "number"
              ? detailsPayload.utcOffsetMinutes
              : null,
          googleRating:
            typeof detailsPayload.rating === "number" ? detailsPayload.rating : null,
          googleUserRatingCount:
            typeof detailsPayload.userRatingCount === "number"
              ? detailsPayload.userRatingCount
              : null,
          googlePriceLevel:
            typeof detailsPayload.priceLevel === "number" ? detailsPayload.priceLevel : null,
          googlePhotosJson: JSON.stringify(detailsPayload.photos),
          googleAttributionsJson: JSON.stringify(detailsPayload.attributions),
          googlePhotoReferencesJson: JSON.stringify(detailsPayload.photoReferences),
          googleCoverPhotoReference: detailsPayload.coverPhotoReference,
          googleDataLastFetchedAt: now,
          googleDataExpiresAt:
            detailsPayload.photos.length > 0 ? nextDataExpiresAt : nextAddressExpiresAt,
          googleRefreshStatus: "success",
          googleRefreshError: null,
          googleRefreshAttemptedAt: now,
          googleRefreshVersion: VENUE_GOOGLE_REFRESH_VERSION,
        };

        if (shouldWriteOwnerManagedField(ownerOverrides, "name")) {
          nextVenuePatch.name = detailsPayload.displayName;
          changedFields.push("name");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "address")) {
          nextVenuePatch.address = detailsPayload.formattedAddress;
          changedFields.push("address");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "city")) {
          nextVenuePatch.city = detailsPayload.city;
          changedFields.push("city");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "phone")) {
          nextVenuePatch.phone = detailsPayload.nationalPhoneNumber;
          changedFields.push("phone");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "websiteUrl")) {
          nextVenuePatch.websiteUrl = detailsPayload.websiteUri;
          nextVenuePatch.officialWebsiteUrl = detailsPayload.websiteUri;
          changedFields.push("websiteUrl");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "googleMapsUrl")) {
          nextVenuePatch.googleMapsUrl = detailsPayload.googleMapsUri;
          changedFields.push("googleMapsUrl");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "openingHoursJson")) {
          nextVenuePatch.openingHoursJson = detailsPayload.regularOpeningHours
            ? JSON.stringify(detailsPayload.regularOpeningHours)
            : null;
          changedFields.push("openingHoursJson");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "latitude")) {
          nextVenuePatch.latitude = detailsPayload.latitude;
          changedFields.push("latitude");
        }

        if (shouldWriteOwnerManagedField(ownerOverrides, "longitude")) {
          nextVenuePatch.longitude = detailsPayload.longitude;
          changedFields.push("longitude");
        }

        nextVenuePatch.averageRating = detailsPayload.rating;
        nextVenuePatch.reviewCount = detailsPayload.userRatingCount;
        nextVenuePatch.priceLevel = detailsPayload.priceLevel;

        if (detailsPayload.currentOpeningHours && typeof detailsPayload.currentOpeningHours === "object") {
          const openNow =
            "openNow" in (detailsPayload.currentOpeningHours as Record<string, unknown>)
              ? Boolean((detailsPayload.currentOpeningHours as Record<string, unknown>).openNow)
              : venue.isOpenNow;
          nextVenuePatch.isOpenNow = openNow;
        }

        if (!dryRun) {
          await db.update(venues).set(nextVenuePatch).where(eq(venues.id, venue.id));

          await db
            .delete(venueGooglePhotoMetadata)
            .where(eq(venueGooglePhotoMetadata.venueId, venue.id));

          if (detailsPayload.photos.length > 0) {
            await db.insert(venueGooglePhotoMetadata).values(
              detailsPayload.photos.slice(0, 16).map((photo, index) => ({
                venueId: venue.id,
                photoResourceName: photo.resourceName,
                widthPx: photo.widthPx,
                heightPx: photo.heightPx,
                authorAttributionsJson: JSON.stringify(photo.attributions),
                rankingPurpose:
                  index === 0
                    ? "hero_candidate"
                    : index === 1
                      ? "thumbnail_candidate"
                      : "gallery_candidate",
                source: "google_places",
                status: "active",
                fetchedAt: now,
                updatedAt: now,
              }))
            );
          }
        }

        successCount += 1;
        details.push({
          venueId: venue.id,
          status: "success",
          requestCount: 1,
          changedFields,
          errorMessage: null,
          failureClassification: null,
          retryable: null,
          providerHttpStatus: null,
          providerStatusCode: null,
          fieldMaskProfile: "place_details",
          correlationId,
        });

        await db
          .update(venueDataRefreshItems)
          .set({
            status: "succeeded",
            requestCount: 1,
            changedFieldsJson: JSON.stringify(changedFields),
            finishedAt: new Date(),
          })
          .where(eq(venueDataRefreshItems.id, item.id));

        if (!dryRun) {
          await db
            .update(venues)
            .set({
              googleDataExpiresAt: resolvedExpiresAt,
              googleRefreshStatus: "success",
              googleRefreshAttemptedAt: now,
            })
            .where(eq(venues.id, venue.id));
        }

        void nextOperationalExpiresAt;
      } catch (error) {
        const placesError =
          error instanceof GooglePlacesRequestError
            ? error
            : null;

        const classification = placesError?.diagnostic.classification ?? "unknown";
        const retryable = placesError?.diagnostic.retryable ?? true;
        const refreshStatus = classifyRefreshStatusFromFailure(classification, retryable);
        const message = placesError
          ? formatSafeFailureMessage(placesError)
          : error instanceof Error
            ? error.message
            : "Google refresh failed.";

        failedCount += 1;
        details.push({
          venueId: venue.id,
          status: "failed",
          requestCount: 1,
          changedFields: [],
          errorMessage: message,
          failureClassification: classification,
          retryable,
          providerHttpStatus: placesError?.diagnostic.httpStatus ?? null,
          providerStatusCode: placesError?.diagnostic.providerStatus ?? null,
          fieldMaskProfile: placesError?.diagnostic.fieldMaskProfile ?? "place_details",
          correlationId: placesError?.diagnostic.correlationId ?? correlationId,
        });

        await db
          .update(venueDataRefreshItems)
          .set({
            status: "failed",
            requestCount: 1,
            errorMessage: message,
            finishedAt: new Date(),
          })
          .where(eq(venueDataRefreshItems.id, item.id));

        if (!dryRun) {
          await db
            .update(venues)
            .set({
              googleRefreshStatus: refreshStatus,
              googleRefreshError: message,
              googleRefreshAttemptedAt: new Date(),
            })
            .where(eq(venues.id, venue.id));
        }
      }
    }

    const finishedAt = new Date();
    const processedVenueCount = successCount + skippedCount + failedCount;

    await db
      .update(venueDataRefreshRuns)
      .set({
        status: failedCount > 0 ? "failed" : "succeeded",
        processedVenueCount,
        successCount,
        skippedCount,
        failedCount,
        finishedAt,
        updatedAt: finishedAt,
      })
      .where(eq(venueDataRefreshRuns.id, runRecord.id));

    await db
      .update(platformJobRuns)
      .set({
        status: failedCount > 0 ? "failed" : "completed",
        finishedAt,
        durationMs: runRecord.startedAt
          ? Math.max(0, finishedAt.getTime() - runRecord.startedAt.getTime())
          : null,
        failureReason: failedCount > 0 ? `${failedCount} venue refresh items failed` : null,
      })
      .where(eq(platformJobRuns.id, jobRun.id));

    await db
      .update(platformJobs)
      .set({
        lastRunAt: finishedAt,
        updatedAt: finishedAt,
      })
      .where(eq(platformJobs.id, platformJob.id));

    return {
      runId: runRecord.id,
      mode: options.mode,
      status: failedCount > 0 ? "failed" : "succeeded",
      dryRun,
      force,
      selectedVenueCount: selectedVenueIds.length,
      processedVenueCount,
      successCount,
      skippedCount,
      failedCount,
      requestCount,
      schedulerState,
      details,
    };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Venue Google refresh failed.";

    await db
      .update(venueDataRefreshRuns)
      .set({
        status: "failed",
        finishedAt,
        updatedAt: finishedAt,
        metadataJson: JSON.stringify({
          mode: options.mode,
          schedulerState,
          error: message,
        }),
      })
      .where(eq(venueDataRefreshRuns.id, runRecord.id));

    await db
      .update(platformJobRuns)
      .set({
        status: "failed",
        finishedAt,
        durationMs: runRecord.startedAt
          ? Math.max(0, finishedAt.getTime() - runRecord.startedAt.getTime())
          : null,
        failureReason: message,
      })
      .where(eq(platformJobRuns.id, jobRun.id));

    throw error;
  } finally {
    await releaseLock(lock.id);
  }
}
