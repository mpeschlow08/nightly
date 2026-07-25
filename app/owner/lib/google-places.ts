type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlaceLocation = {
  latitude?: number;
  longitude?: number;
};

type GoogleSearchPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: GooglePlaceLocation;
};

type GoogleDetailsPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: unknown;
  location?: GooglePlaceLocation;
  googleMapsUri?: string;
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
  websiteUri: string | null;
  regularOpeningHours: unknown | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUri: string | null;
};

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const ATLANTA_LOCATION_BIAS = {
  circle: {
    center: {
      latitude: 33.749,
      longitude: -84.388,
    },
    radius: 50000,
  },
};

const GOOGLE_TEXT_SEARCH_FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location";
const GOOGLE_PLACE_DETAILS_FIELDS =
  "id,displayName,formattedAddress,addressComponents,nationalPhoneNumber,websiteUri,regularOpeningHours,location,googleMapsUri";

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

  return {
    placeId,
    displayName,
    formattedAddress,
    city: parseCity(place.addressComponents),
    nationalPhoneNumber: place.nationalPhoneNumber?.trim() || null,
    websiteUri: place.websiteUri?.trim() || null,
    regularOpeningHours: place.regularOpeningHours ?? null,
    latitude: Number.isFinite(place.location?.latitude)
      ? (place.location?.latitude as number)
      : null,
    longitude: Number.isFinite(place.location?.longitude)
      ? (place.location?.longitude as number)
      : null,
    googleMapsUri: place.googleMapsUri?.trim() || null,
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

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_TEXT_SEARCH_FIELDS,
    },
    body: JSON.stringify({
      textQuery: `${query}${cityHint}`,
      maxResultCount: 8,
      languageCode: "en",
      locationBias,
    }),
  });

  if (!response.ok) {
    throw new Error("Google Places Text Search failed.");
  }

  const payload = (await response.json()) as { places?: GoogleSearchPlace[] };
  const rawPlaces = payload.places ?? [];

  return rawPlaces
    .map(toVenueSearchResult)
    .filter((place): place is VenueSearchResult => Boolean(place));
}

export async function getGooglePlaceVenueDetails(placeIdInput: string) {
  const apiKey = getGooglePlacesApiKey();
  const placeId = normalizePlaceId(placeIdInput);

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACE_DETAILS_FIELDS,
    },
  });

  if (!response.ok) {
    throw new Error("Google Place Details request failed.");
  }

  const payload = (await response.json()) as GoogleDetailsPlace;

  return toVenuePlaceDetails(payload);
}
