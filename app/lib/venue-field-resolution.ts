import type { InferSelectModel } from "drizzle-orm";

import { venues } from "@/db/schema";

export type VenueRow = InferSelectModel<typeof venues>;

export type VenueResolvedSource =
  | "owner_override"
  | "admin_override"
  | "google_places"
  | "imported"
  | "nightly_fallback";

export type VenueResolvedValue<T> = {
  value: T;
  source: VenueResolvedSource;
  sourceTimestamp: Date | null;
  ownerOverride: boolean;
  confidence: "high" | "medium" | "low" | "none";
  attributionRequired: boolean;
  stale: boolean;
};

function asStringArray(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [] as string[];
  }
}

function hasValue<T>(value: T | null | undefined): value is T {
  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

function isGoogleFresh(venue: Pick<VenueRow, "googleDataExpiresAt">) {
  if (!venue.googleDataExpiresAt) {
    return false;
  }

  return venue.googleDataExpiresAt.getTime() > Date.now();
}

export function resolveVenueField<T>(input: {
  venue: Pick<
    VenueRow,
    "ownerOverrideFieldsJson" | "adminOverrideFieldsJson" | "googleDataLastFetchedAt" | "googleDataExpiresAt"
  >;
  fieldKey: string;
  ownerValue: T | null | undefined;
  adminValue: T | null | undefined;
  googleValue: T | null | undefined;
  importedValue: T | null | undefined;
  fallbackValue: T;
  googleAttributed?: boolean;
}): VenueResolvedValue<T> {
  const ownerOverrideFields = new Set(asStringArray(input.venue.ownerOverrideFieldsJson));
  const adminOverrideFields = new Set(asStringArray(input.venue.adminOverrideFieldsJson));

  const ownerEnabled = ownerOverrideFields.has(input.fieldKey) && hasValue(input.ownerValue);
  if (ownerEnabled) {
    return {
      value: input.ownerValue as T,
      source: "owner_override",
      sourceTimestamp: null,
      ownerOverride: true,
      confidence: "high",
      attributionRequired: false,
      stale: false,
    };
  }

  const adminEnabled = adminOverrideFields.has(input.fieldKey) && hasValue(input.adminValue);
  if (adminEnabled) {
    return {
      value: input.adminValue as T,
      source: "admin_override",
      sourceTimestamp: null,
      ownerOverride: false,
      confidence: "high",
      attributionRequired: false,
      stale: false,
    };
  }

  if (hasValue(input.googleValue)) {
    const stale = !isGoogleFresh(input.venue);

    return {
      value: input.googleValue as T,
      source: "google_places",
      sourceTimestamp: input.venue.googleDataLastFetchedAt,
      ownerOverride: false,
      confidence: stale ? "medium" : "high",
      attributionRequired: Boolean(input.googleAttributed),
      stale,
    };
  }

  if (hasValue(input.importedValue)) {
    return {
      value: input.importedValue as T,
      source: "imported",
      sourceTimestamp: input.venue.googleDataLastFetchedAt,
      ownerOverride: false,
      confidence: "medium",
      attributionRequired: false,
      stale: false,
    };
  }

  return {
    value: input.fallbackValue,
    source: "nightly_fallback",
    sourceTimestamp: null,
    ownerOverride: false,
    confidence: "low",
    attributionRequired: false,
    stale: false,
  };
}
