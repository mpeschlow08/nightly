"use client";

import { useMemo, useState } from "react";

type VenueSearchResult = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type VenuePlaceDetails = {
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
  photoReferences: string[];
  coverPhotoReference: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
};

type DraftForm = {
  googlePlaceId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  websiteUrl: string;
  openingHoursJson: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
  photoReferencesJson: string;
  coverPhotoReference: string;
  coverImageUrl: string;
  galleryImageUrlsJson: string;
  logoImageUrl: string;
};

type ExistingVenueValues = {
  name: string;
  address: string;
  city: string;
  phone: string;
  websiteUrl: string;
  openingHoursJson: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
};

type Props = {
  venueId: number;
  existingVenue: ExistingVenueValues;
  importAction: (formData: FormData) => Promise<void>;
};

function isMeaningful(value: string) {
  return value.trim().length > 0;
}

function countJsonArrayItems(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function toDraftFromDetails(details: VenuePlaceDetails): DraftForm {
  return {
    googlePlaceId: details.placeId,
    name: details.displayName,
    address: details.formattedAddress,
    city: details.city ?? "",
    phone: details.nationalPhoneNumber ?? "",
    websiteUrl: details.websiteUri ?? "",
    openingHoursJson: details.regularOpeningHours
      ? JSON.stringify(details.regularOpeningHours, null, 2)
      : "",
    latitude:
      typeof details.latitude === "number" && Number.isFinite(details.latitude)
        ? String(details.latitude)
        : "",
    longitude:
      typeof details.longitude === "number" && Number.isFinite(details.longitude)
        ? String(details.longitude)
        : "",
    googleMapsUrl: details.googleMapsUri ?? "",
    photoReferencesJson:
      details.photoReferences.length > 0 ? JSON.stringify(details.photoReferences) : "",
    coverPhotoReference: details.coverPhotoReference ?? "",
    coverImageUrl: details.coverImageUrl ?? "",
    galleryImageUrlsJson:
      details.galleryImageUrls.length > 0 ? JSON.stringify(details.galleryImageUrls) : "",
    logoImageUrl: details.logoImageUrl ?? "",
  };
}

export function ImportBusinessInformationSection({
  venueId,
  existingVenue,
  importAction,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueSearchResult[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedResult = useMemo(
    () => results.find((result) => result.placeId === selectedPlaceId) ?? null,
    [results, selectedPlaceId]
  );

  const hasConflicts = useMemo(() => {
    if (!draft) {
      return false;
    }

    const comparisons = [
      [existingVenue.name, draft.name],
      [existingVenue.address, draft.address],
      [existingVenue.city, draft.city],
      [existingVenue.phone, draft.phone],
      [existingVenue.websiteUrl, draft.websiteUrl],
      [existingVenue.openingHoursJson, draft.openingHoursJson],
      [existingVenue.latitude, draft.latitude],
      [existingVenue.longitude, draft.longitude],
      [existingVenue.googleMapsUrl, draft.googleMapsUrl],
    ];

    return comparisons.some(([existingValue, incomingValue]) => {
      if (!isMeaningful(existingValue)) {
        return false;
      }

      if (!isMeaningful(incomingValue)) {
        return false;
      }

      return existingValue.trim() !== incomingValue.trim();
    });
  }, [draft, existingVenue]);

  async function runSearch() {
    setError(null);
    setIsSearching(true);

    try {
      const response = await fetch("/api/owner/google-places/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueId,
          query,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        results?: VenueSearchResult[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }

      setResults(payload.results ?? []);
      setSelectedPlaceId(null);
      setDraft(null);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  async function loadDetails(placeId: string) {
    setError(null);
    setIsLoadingDetails(true);

    try {
      const response = await fetch("/api/owner/google-places/details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueId,
          placeId,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        details?: VenuePlaceDetails;
      };

      if (!response.ok || !payload.details) {
        throw new Error(payload.error ?? "Details request failed.");
      }

      setSelectedPlaceId(placeId);
      setDraft(toDraftFromDetails(payload.details));
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : "Details request failed.");
    } finally {
      setIsLoadingDetails(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <p className="text-sm font-semibold text-zinc-100">Import business information</p>
      <p className="mt-2 text-sm text-zinc-300">
        Review and confirm this business information before saving it to your Nightly venue profile.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for your venue"
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={isSearching}
          className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-4 space-y-2">
          {results.map((result) => (
            <button
              key={result.placeId}
              type="button"
              onClick={() => loadDetails(result.placeId)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-3 text-left transition hover:border-cyan-400/40"
            >
              <p className="text-sm font-medium text-zinc-100">{result.displayName}</p>
              <p className="mt-1 text-xs text-zinc-300">{result.formattedAddress}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                {result.city ?? "City unknown"}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {selectedResult ? (
        <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Selected: {selectedResult.displayName}
        </div>
      ) : null}

      {draft ? (
        <form action={importAction} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="venueId" value={venueId} />
          <input type="hidden" name="googlePlaceId" value={draft.googlePlaceId} />
          <input type="hidden" name="googlePhotoReferencesJson" value={draft.photoReferencesJson} />
          <input type="hidden" name="googleCoverPhotoReference" value={draft.coverPhotoReference} />
          <input type="hidden" name="googleCoverImageUrl" value={draft.coverImageUrl} />
          <input type="hidden" name="googleGalleryImageUrlsJson" value={draft.galleryImageUrlsJson} />
          <input type="hidden" name="googleLogoImageUrl" value={draft.logoImageUrl} />

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-200">Venue name</label>
            <input
              name="name"
              value={draft.name}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
              }
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-200">Address</label>
            <input
              name="address"
              value={draft.address}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, address: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-200">City</label>
            <input
              name="city"
              value={draft.city}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, city: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-200">Phone</label>
            <input
              name="phone"
              value={draft.phone}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, phone: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-200">Website URL</label>
            <input
              name="websiteUrl"
              value={draft.websiteUrl}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, websiteUrl: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-200">Latitude</label>
            <input
              name="latitude"
              value={draft.latitude}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, latitude: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-200">Longitude</label>
            <input
              name="longitude"
              value={draft.longitude}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, longitude: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-200">Google Maps URL</label>
            <input
              name="googleMapsUrl"
              value={draft.googleMapsUrl}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, googleMapsUrl: event.target.value } : prev))
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-200">Opening hours JSON</label>
            <textarea
              name="openingHoursJson"
              value={draft.openingHoursJson}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, openingHoursJson: event.target.value } : prev
                )
              }
              rows={6}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2 rounded-xl border border-white/10 bg-zinc-900/65 px-3 py-2 text-xs text-zinc-300">
            <p className="font-medium text-zinc-100">Imported imagery preview</p>
            <p className="mt-1">Cover image: {isMeaningful(draft.coverImageUrl) ? "Available" : "Not available"}</p>
            <p className="mt-1">Gallery images: {countJsonArrayItems(draft.galleryImageUrlsJson)}</p>
            <p className="mt-1">Logo image: {isMeaningful(draft.logoImageUrl) ? "Available" : "Not available"}</p>
          </div>

          {hasConflicts ? (
            <label className="sm:col-span-2 inline-flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <input type="checkbox" name="confirmOverwrite" value="true" className="mt-0.5 h-4 w-4 accent-amber-500" />
              Confirm overwrite for existing non-empty venue fields.
            </label>
          ) : (
            <input type="hidden" name="confirmOverwrite" value="true" />
          )}

          <label className="sm:col-span-2 inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
            <input type="checkbox" name="confirmReview" value="true" required className="mt-0.5 h-4 w-4 accent-cyan-500" />
            I reviewed and confirm these values before saving them to my Nightly venue profile.
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => loadDetails(draft.googlePlaceId)}
              disabled={isLoadingDetails}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingDetails ? "Refreshing..." : "Refresh from Google"}
            </button>
            <button
              type="submit"
              className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
            >
              Confirm and save import
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-xs text-zinc-400">
          Select a search result before importing business information.
        </p>
      )}
    </section>
  );
}
