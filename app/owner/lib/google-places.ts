type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlaceLocation = {
  latitude?: number;
  longitude?: number;
};

type GooglePlacePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: Array<{ displayName?: string; uri?: string }>;
};

type GoogleSearchPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: GooglePlaceLocation;
};

type GoogleDetailsPlace = {
  name?: string;
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: unknown;
  currentOpeningHours?: unknown;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  utcOffsetMinutes?: number;
  location?: GooglePlaceLocation;
  googleMapsUri?: string;
  photos?: GooglePlacePhoto[];
  iconMaskBaseUri?: string;
};

export type VenueSearchResult = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type VenuePlaceDetails = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  city: string | null;
  nationalPhoneNumber: string | null;
  internationalPhoneNumber: string | null;
  websiteUri: string | null;
  regularOpeningHours: unknown | null;
  currentOpeningHours: unknown | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUri: string | null;
  googleResourceName: string | null;
  businessStatus: string | null;
  primaryType: string | null;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  utcOffsetMinutes: number | null;
  photos: Array<{
    reference: string;
    resourceName: string;
    widthPx: number | null;
    heightPx: number | null;
    attributions: Array<{ displayName: string | null; uri: string | null }>;
  }>;
  attributions: Array<{ displayName: string | null; uri: string | null }>;
  photoReferences: string[];
  coverPhotoReference: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
};

export type GooglePlacesFailureClassification =
  | "invalid_place_id"
  | "place_not_found"
  | "place_moved"
  | "place_closed"
  | "permission_denied"
  | "billing_required"
  | "quota_exceeded"
  | "rate_limited"
  | "unsupported_field"
  | "invalid_field_mask"
  | "provider_4xx"
  | "provider_5xx"
  | "network_timeout"
  | "response_validation"
  | "unknown";

export type GooglePlacesErrorDiagnostic = {
  endpointPath: string;
  fieldMaskProfile: "text_search" | "place_details";
  httpStatus: number | null;
  providerCode: number | null;
  providerStatus: string | null;
  providerMessage: string | null;
  classification: GooglePlacesFailureClassification;
  retryable: boolean;
  attempts: number;
  maxRetries: number;
  timeoutMs: number;
  correlationId: string | null;
};

export class GooglePlacesRequestError extends Error {
  diagnostic: GooglePlacesErrorDiagnostic;

  constructor(message: string, diagnostic: GooglePlacesErrorDiagnostic) {
    super(message);
    this.name = "GooglePlacesRequestError";
    this.diagnostic = diagnostic;
  }
}

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const DEFAULT_FETCH_TIMEOUT_MS = 5500;
const DEFAULT_MAX_RETRIES = 2;
const GOOGLE_REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const ATLANTA_LOCATION_BIAS = {
  circle: {
    center: {
      latitude: 33.749,
      longitude: -84.388,
    },
    radius: 50000,
  },
};

function compactWhitespace(input: string | null | undefined) {
  return input?.replace(/\s+/g, " ").trim() || null;
}

type ErrorClassificationInput = {
  httpStatus: number | null;
  providerStatus: string | null;
  providerMessage: string | null;
};

export function classifyGooglePlacesFailure({
  httpStatus,
  providerStatus,
  providerMessage,
}: ErrorClassificationInput): {
  classification: GooglePlacesFailureClassification;
  retryable: boolean;
} {
  const status = providerStatus?.toUpperCase() ?? "";
  const message = (providerMessage ?? "").toLowerCase();

  if (httpStatus === 429 || status === "RESOURCE_EXHAUSTED") {
    if (message.includes("billing") || message.includes("enable billing")) {
      return { classification: "billing_required", retryable: false };
    }

    return {
      classification: httpStatus === 429 ? "rate_limited" : "quota_exceeded",
      retryable: true,
    };
  }

  if (status === "PERMISSION_DENIED" || status === "UNAUTHENTICATED") {
    return { classification: "permission_denied", retryable: false };
  }

  if (status === "NOT_FOUND") {
    return { classification: "place_not_found", retryable: false };
  }

  if (status === "INVALID_ARGUMENT") {
    if (message.includes("place id") && message.includes("not valid")) {
      return { classification: "invalid_place_id", retryable: false };
    }

    if (message.includes("fieldmask") || message.includes("field mask")) {
      return { classification: "invalid_field_mask", retryable: false };
    }

    if (message.includes("unsupported")) {
      return { classification: "unsupported_field", retryable: false };
    }

    return { classification: "provider_4xx", retryable: false };
  }

  if (status === "FAILED_PRECONDITION") {
    if (message.includes("billing") || message.includes("project")) {
      return { classification: "billing_required", retryable: false };
    }

    return { classification: "provider_4xx", retryable: false };
  }

  if (httpStatus !== null && httpStatus >= 500) {
    return { classification: "provider_5xx", retryable: true };
  }

  if (httpStatus !== null && httpStatus >= 400) {
    return { classification: "provider_4xx", retryable: false };
  }

  return { classification: "unknown", retryable: true };
}

function createGooglePlacesError(
  message: string,
  diagnostic: Omit<GooglePlacesErrorDiagnostic, "classification" | "retryable"> & {
    classification?: GooglePlacesFailureClassification;
    retryable?: boolean;
  }
) {
  const classified = diagnostic.classification
    ? { classification: diagnostic.classification, retryable: diagnostic.retryable ?? false }
    : classifyGooglePlacesFailure({
        httpStatus: diagnostic.httpStatus,
        providerStatus: diagnostic.providerStatus,
        providerMessage: diagnostic.providerMessage,
      });

  return new GooglePlacesRequestError(message, {
    ...diagnostic,
    classification: classified.classification,
    retryable: classified.retryable,
  });
}

export const GOOGLE_PLACES_FIELD_MASKS = {
  venueIdentity:
    "name,id,displayName,formattedAddress,businessStatus,primaryType,types",
  contactDetails: "nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri",
  location: "addressComponents,location,utcOffsetMinutes",
  hours: "regularOpeningHours,currentOpeningHours",
  imagery: "photos,iconMaskBaseUri",
  ratings: "rating,userRatingCount,priceLevel",
} as const;

export const GOOGLE_TEXT_SEARCH_FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location";

export const GOOGLE_PLACE_DETAILS_FIELDS = [
  GOOGLE_PLACES_FIELD_MASKS.venueIdentity,
  GOOGLE_PLACES_FIELD_MASKS.contactDetails,
  GOOGLE_PLACES_FIELD_MASKS.location,
  GOOGLE_PLACES_FIELD_MASKS.hours,
  GOOGLE_PLACES_FIELD_MASKS.imagery,
  GOOGLE_PLACES_FIELD_MASKS.ratings,
].join(",");

export const MAX_VENUE_SEARCH_QUERY_LENGTH = 120;

function getGooglePlacesApiKey() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
  }

  return apiKey;
}

export function sanitizeVenueSearchQuery(query: string) {
  const withoutControlChars = query.replace(/[\x00-\x1F\x7F]/g, " ");
  const withoutUnsafeChars = withoutControlChars.replace(/[^\w\s,'.&-]/g, " ");
  const collapsed = withoutUnsafeChars.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    throw new Error("Search query is required.");
  }

  if (collapsed.length > MAX_VENUE_SEARCH_QUERY_LENGTH) {
    throw new Error(
      `Search query must be ${MAX_VENUE_SEARCH_QUERY_LENGTH} characters or fewer.`
    );
  }

  return collapsed;
}

function normalizePhotoReference(reference: string | undefined) {
  const trimmed = reference?.trim() ?? "";

  return trimmed.length > 0 ? trimmed.replace(/^\/+/, "") : null;
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAttributions(
  photo: GooglePlacePhoto
): Array<{ displayName: string | null; uri: string | null }> {
  return (photo.authorAttributions ?? []).map((item) => ({
    displayName: item.displayName?.trim() || null,
    uri: item.uri?.trim() || null,
  }));
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  options: {
    retries?: number;
    timeoutMs?: number;
    endpointPath: string;
    fieldMaskProfile: "text_search" | "place_details";
    correlationId?: string | null;
  }
) {
  const retries = Math.max(0, options.retries ?? DEFAULT_MAX_RETRIES);
  const timeoutMs = Math.max(500, options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);

  let attempt = 0;
  let lastError: GooglePlacesRequestError | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const attemptNumber = attempt + 1;

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      let providerCode: number | null = null;
      let providerStatus: string | null = null;
      let providerMessage: string | null = null;

      try {
        const payload = (await response.clone().json()) as {
          error?: { code?: number; status?: string; message?: string };
        };
        providerCode = typeof payload.error?.code === "number" ? payload.error.code : null;
        providerStatus = compactWhitespace(payload.error?.status ?? null);
        providerMessage = compactWhitespace(payload.error?.message ?? null);
      } catch {
        providerCode = null;
        providerStatus = null;
        providerMessage = null;
      }

      lastError = createGooglePlacesError(
        `Google Places request failed with status ${response.status}.`,
        {
          endpointPath: options.endpointPath,
          fieldMaskProfile: options.fieldMaskProfile,
          httpStatus: response.status,
          providerCode,
          providerStatus,
          providerMessage,
          attempts: attemptNumber,
          maxRetries: retries,
          timeoutMs,
          correlationId: options.correlationId ?? null,
        }
      );

      if (!lastError.diagnostic.retryable) {
        throw lastError;
      }
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof GooglePlacesRequestError) {
        lastError = error;
      } else {
        const aborted = error instanceof Error && error.name === "AbortError";
        const message = error instanceof Error ? compactWhitespace(error.message) : null;

        lastError = createGooglePlacesError(
          aborted ? "Google Places request timed out." : "Google Places request failed.",
          {
            endpointPath: options.endpointPath,
            fieldMaskProfile: options.fieldMaskProfile,
            httpStatus: null,
            providerCode: null,
            providerStatus: null,
            providerMessage: message,
            classification: aborted ? "network_timeout" : "unknown",
            retryable: true,
            attempts: attemptNumber,
            maxRetries: retries,
            timeoutMs,
            correlationId: options.correlationId ?? null,
          }
        );
      }
    }

    if (attempt < retries && lastError?.diagnostic.retryable) {
      const backoffMs = 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 125);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    attempt += 1;
  }

  throw (
    lastError ??
    createGooglePlacesError("Google Places request failed.", {
      endpointPath: options.endpointPath,
      fieldMaskProfile: options.fieldMaskProfile,
      httpStatus: null,
      providerCode: null,
      providerStatus: null,
      providerMessage: null,
      classification: "unknown",
      retryable: true,
      attempts: retries + 1,
      maxRetries: retries,
      timeoutMs,
      correlationId: options.correlationId ?? null,
    })
  );
}

export function buildGooglePlacePhotoMediaUrl(photoReference: string, maxWidthPx = 1600) {
  const normalizedReference = normalizePhotoReference(photoReference);

  if (!normalizedReference) {
    return null;
  }

  return `/api/venues/google-photo?ref=${encodeURIComponent(normalizedReference)}&maxWidthPx=${maxWidthPx}`;
}

function parseCity(addressComponents: GoogleAddressComponent[] | undefined) {
  if (!addressComponents?.length) {
    return null;
  }

  const locality = addressComponents.find((component) =>
    component.types?.includes("locality")
  );

  if (locality?.longText?.trim()) {
    return locality.longText.trim();
  }

  const postalTown = addressComponents.find((component) =>
    component.types?.includes("postal_town")
  );

  if (postalTown?.longText?.trim()) {
    return postalTown.longText.trim();
  }

  const adminLevelThree = addressComponents.find((component) =>
    component.types?.includes("administrative_area_level_3")
  );

  if (adminLevelThree?.longText?.trim()) {
    return adminLevelThree.longText.trim();
  }

  return null;
}

function toVenueSearchResult(place: GoogleSearchPlace): VenueSearchResult | null {
  const placeId = place.id?.trim();
  const displayName = place.displayName?.text?.trim();
  const formattedAddress = place.formattedAddress?.trim();

  if (!placeId || !displayName || !formattedAddress) {
    return null;
  }

  return {
    placeId,
    displayName,
    formattedAddress,
    city: parseCity(place.addressComponents),
    latitude: Number.isFinite(place.location?.latitude)
      ? (place.location?.latitude as number)
      : null,
    longitude: Number.isFinite(place.location?.longitude)
      ? (place.location?.longitude as number)
      : null,
  };
}

function toVenuePlaceDetails(place: GoogleDetailsPlace): VenuePlaceDetails {
  const placeId = place.id?.trim();
  const displayName = place.displayName?.text?.trim();
  const formattedAddress = place.formattedAddress?.trim();

  if (!placeId || !displayName || !formattedAddress) {
    throw new Error("Google Place Details response was missing required fields.");
  }

  const photoReferences = Array.from(
    new Set(
      (place.photos ?? [])
        .map((photo) => normalizePhotoReference(photo.name))
        .filter((value): value is string => Boolean(value))
    )
  );

  const photos = (place.photos ?? [])
    .map((photo) => {
      const resourceName = photo.name?.trim() ?? "";
      const reference = normalizePhotoReference(resourceName);

      if (!reference || !resourceName) {
        return null;
      }

      return {
        reference,
        resourceName,
        widthPx: asFiniteNumber(photo.widthPx),
        heightPx: asFiniteNumber(photo.heightPx),
        attributions: normalizeAttributions(photo),
      };
    })
    .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));

  const attributions = Array.from(
    new Map(
      photos
        .flatMap((photo) => photo.attributions)
        .filter((item) => item.displayName || item.uri)
        .map((item) => [`${item.displayName ?? ""}|${item.uri ?? ""}`, item])
    ).values()
  );

  const coverPhotoReference = photoReferences[0] ?? null;
  const coverImageUrl = coverPhotoReference
    ? buildGooglePlacePhotoMediaUrl(coverPhotoReference, 1800)
    : null;
  const galleryImageUrls = photoReferences
    .map((reference) => buildGooglePlacePhotoMediaUrl(reference, 1400))
    .filter((value): value is string => Boolean(value));

  const logoImageUrl =
    place.iconMaskBaseUri?.trim()
      ? `${place.iconMaskBaseUri.trim()}.png`
      : null;

  return {
    placeId,
    displayName,
    formattedAddress,
    city: parseCity(place.addressComponents),
    nationalPhoneNumber: place.nationalPhoneNumber?.trim() || null,
    internationalPhoneNumber: place.internationalPhoneNumber?.trim() || null,
    websiteUri: place.websiteUri?.trim() || null,
    regularOpeningHours: place.regularOpeningHours ?? null,
    currentOpeningHours: place.currentOpeningHours ?? null,
    latitude: Number.isFinite(place.location?.latitude)
      ? (place.location?.latitude as number)
      : null,
    longitude: Number.isFinite(place.location?.longitude)
      ? (place.location?.longitude as number)
      : null,
    googleMapsUri: place.googleMapsUri?.trim() || null,
    googleResourceName: place.name?.trim() || null,
    businessStatus: place.businessStatus?.trim() || null,
    primaryType: place.primaryType?.trim() || null,
    types: Array.isArray(place.types) ? place.types.filter((item) => item.trim().length > 0) : [],
    rating: asFiniteNumber(place.rating),
    userRatingCount: asFiniteNumber(place.userRatingCount),
    priceLevel: asFiniteNumber(place.priceLevel),
    utcOffsetMinutes: asFiniteNumber(place.utcOffsetMinutes),
    photos,
    attributions,
    photoReferences,
    coverPhotoReference,
    logoImageUrl,
    coverImageUrl,
    galleryImageUrls,
  };
}

function normalizePlaceId(rawPlaceId: string) {
  const trimmed = rawPlaceId.trim();

  if (!trimmed) {
    throw new Error("Google place ID is required.");
  }

  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("Google place ID is invalid.");
  }

  return trimmed;
}

type SearchPlacesOptions = {
  query: string;
  venueCity?: string | null;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
  correlationId?: string | null;
};

export async function searchGooglePlacesVenues(options: SearchPlacesOptions) {
  const apiKey = getGooglePlacesApiKey();
  const query = sanitizeVenueSearchQuery(options.query);
  const venueCity = options.venueCity?.trim() || null;
  const cityHint = venueCity && !query.toLowerCase().includes(venueCity.toLowerCase())
    ? ` near ${venueCity}`
    : "";

  const locationBias =
    Number.isFinite(options.venueLatitude) && Number.isFinite(options.venueLongitude)
      ? {
          circle: {
            center: {
              latitude: options.venueLatitude as number,
              longitude: options.venueLongitude as number,
            },
            radius: 50000,
          },
        }
      : ATLANTA_LOCATION_BIAS;

  const response = await fetchWithRetry(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_TEXT_SEARCH_FIELDS,
      ...(options.correlationId ? { "X-Correlation-Id": options.correlationId } : {}),
    },
    body: JSON.stringify({
      textQuery: `${query}${cityHint}`,
      maxResultCount: 8,
      languageCode: "en",
      locationBias,
    }),
  }, {
    endpointPath: "/v1/places:searchText",
    fieldMaskProfile: "text_search",
    correlationId: options.correlationId ?? null,
  });

  const payload = (await response.json()) as { places?: GoogleSearchPlace[] };
  const rawPlaces = payload.places ?? [];

  return rawPlaces
    .map(toVenueSearchResult)
    .filter((place): place is VenueSearchResult => Boolean(place));
}

export async function getGooglePlaceVenueDetails(
  placeIdInput: string,
  options: { correlationId?: string | null } = {}
) {
  const apiKey = getGooglePlacesApiKey();
  const placeId = normalizePlaceId(placeIdInput);

  const response = await fetchWithRetry(`${GOOGLE_PLACES_BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACE_DETAILS_FIELDS,
      ...(options.correlationId ? { "X-Correlation-Id": options.correlationId } : {}),
    },
  }, {
    endpointPath: "/v1/places/{placeId}",
    fieldMaskProfile: "place_details",
    correlationId: options.correlationId ?? null,
  });

  const payload = (await response.json()) as GoogleDetailsPlace;
  const businessStatus = payload.businessStatus?.trim().toUpperCase() ?? null;

  if (businessStatus === "CLOSED_PERMANENTLY") {
    throw createGooglePlacesError("Google place is permanently closed.", {
      endpointPath: "/v1/places/{placeId}",
      fieldMaskProfile: "place_details",
      httpStatus: response.status,
      providerCode: response.status,
      providerStatus: businessStatus,
      providerMessage: "Place is permanently closed.",
      classification: "place_closed",
      retryable: false,
      attempts: 1,
      maxRetries: DEFAULT_MAX_RETRIES,
      timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
      correlationId: options.correlationId ?? null,
    });
  }

  let details: VenuePlaceDetails;

  try {
    details = toVenuePlaceDetails(payload);
  } catch (error) {
    const message = error instanceof Error ? compactWhitespace(error.message) : "Invalid response payload";
    throw createGooglePlacesError("Google Place Details response validation failed.", {
      endpointPath: "/v1/places/{placeId}",
      fieldMaskProfile: "place_details",
      httpStatus: response.status,
      providerCode: response.status,
      providerStatus: null,
      providerMessage: message,
      classification: "response_validation",
      retryable: false,
      attempts: 1,
      maxRetries: DEFAULT_MAX_RETRIES,
      timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
      correlationId: options.correlationId ?? null,
    });
  }

  return {
    ...details,
    dataExpiresAt: new Date(Date.now() + GOOGLE_REFRESH_TTL_MS),
  };
}
