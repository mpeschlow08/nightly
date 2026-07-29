import { notFound } from "next/navigation";

import { importOwnerVenueFromGoogleAction, updateOwnerVenueAction } from "../actions";
import { getOwnerVenue } from "../lib/data";
import { OwnerBlobImageUpload } from "@/components/owner/OwnerBlobImageUpload";
import { ImportBusinessInformationSection } from "@/components/owner/ImportBusinessInformationSection";

type OwnerVenuePageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function OwnerVenuePage({ searchParams }: OwnerVenuePageProps) {
  const [{ venueId, venue }, params] = await Promise.all([getOwnerVenue(), searchParams]);

  if (!venue) {
    notFound();
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Venue Profile</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Edit Venue Details</h2>
      <p className="mt-2 text-sm text-zinc-300">Update consumer-facing venue fields for your assigned venue.</p>

      {params.success ? (
        <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {params.success}
        </div>
      ) : null}
      {params.error ? (
        <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {params.error}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <p className="text-sm font-medium text-zinc-200">Venue logo</p>
        <p className="mt-1 text-xs text-zinc-400">Upload a square-friendly logo. New uploads replace the current logo.</p>

        <div className="mt-4">
          {venue.logoUrl ? (
            <img
              src={venue.logoUrl}
              alt={`${venue.name} logo`}
              className="h-24 w-24 rounded-2xl border border-white/10 bg-white/5 object-contain p-2"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-zinc-900/70 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              No logo
            </div>
          )}
        </div>

        <OwnerBlobImageUpload
          venueId={venueId}
          mode="logo"
          maxSizeBytes={5 * 1024 * 1024}
          title="Upload logo"
          description="JPEG, PNG, WebP, or AVIF. Up to 5 MB."
          buttonLabel="Upload logo"
          successText="Logo updated."
        />
      </div>

      <ImportBusinessInformationSection
        venueId={venueId}
        importAction={importOwnerVenueFromGoogleAction}
        existingVenue={{
          name: venue.name,
          address: venue.address ?? "",
          city: venue.city ?? "",
          phone: venue.phone ?? "",
          websiteUrl: venue.websiteUrl ?? "",
          openingHoursJson: venue.openingHoursJson ?? "",
          latitude:
            typeof venue.latitude === "number" && Number.isFinite(venue.latitude)
              ? String(venue.latitude)
              : "",
          longitude:
            typeof venue.longitude === "number" && Number.isFinite(venue.longitude)
              ? String(venue.longitude)
              : "",
          googleMapsUrl: venue.googleMapsUrl ?? "",
        }}
      />

      <form action={updateOwnerVenueAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="venueId" value={venueId} />

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-name" className="text-sm font-medium text-zinc-200">
            Venue name
          </label>
          <input
            id="owner-venue-name"
            name="name"
            defaultValue={venue.name}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-description" className="text-sm font-medium text-zinc-200">
            Description
          </label>
          <textarea
            id="owner-venue-description"
            name="description"
            rows={3}
            defaultValue={venue.description ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-tagline" className="text-sm font-medium text-zinc-200">
            Tagline
          </label>
          <input
            id="owner-venue-tagline"
            name="tagline"
            defaultValue={venue.tagline ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-address" className="text-sm font-medium text-zinc-200">
            Address
          </label>
          <input
            id="owner-venue-address"
            name="address"
            defaultValue={venue.address ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-city" className="text-sm font-medium text-zinc-200">
            City
          </label>
          <input
            id="owner-venue-city"
            name="city"
            defaultValue={venue.city ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-genres" className="text-sm font-medium text-zinc-200">
            Music genres
          </label>
          <input
            id="owner-venue-genres"
            name="genres"
            defaultValue={venue.genres?.join(", ") ?? ""}
            placeholder="House, Techno, Open Format"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-price-level" className="text-sm font-medium text-zinc-200">
            Price level (1-4)
          </label>
          <input
            id="owner-venue-price-level"
            name="priceLevel"
            type="number"
            min="1"
            max="4"
            defaultValue={venue.priceLevel ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-age-requirement" className="text-sm font-medium text-zinc-200">
            Age requirement
          </label>
          <input
            id="owner-venue-age-requirement"
            name="ageRequirement"
            type="number"
            min="0"
            max="25"
            defaultValue={venue.ageRequirement ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-dress-code" className="text-sm font-medium text-zinc-200">
            Dress code
          </label>
          <input
            id="owner-venue-dress-code"
            name="dressCode"
            defaultValue={venue.dressCode ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-phone" className="text-sm font-medium text-zinc-200">
            Phone
          </label>
          <input
            id="owner-venue-phone"
            name="phone"
            defaultValue={venue.phone ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-website" className="text-sm font-medium text-zinc-200">
            Website URL
          </label>
          <input
            id="owner-venue-website"
            name="websiteUrl"
            defaultValue={venue.websiteUrl ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-latitude" className="text-sm font-medium text-zinc-200">
            Latitude
          </label>
          <input
            id="owner-venue-latitude"
            name="latitude"
            defaultValue={venue.latitude ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-longitude" className="text-sm font-medium text-zinc-200">
            Longitude
          </label>
          <input
            id="owner-venue-longitude"
            name="longitude"
            defaultValue={venue.longitude ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-google-maps" className="text-sm font-medium text-zinc-200">
            Google Maps URL
          </label>
          <input
            id="owner-venue-google-maps"
            name="googleMapsUrl"
            defaultValue={venue.googleMapsUrl ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="owner-venue-opening-hours-json" className="text-sm font-medium text-zinc-200">
            Opening hours JSON
          </label>
          <textarea
            id="owner-venue-opening-hours-json"
            name="openingHoursJson"
            rows={6}
            defaultValue={venue.openingHoursJson ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor="owner-venue-crowd" className="text-sm font-medium text-zinc-200">
            Crowd level
          </label>
          <select
            id="owner-venue-crowd"
            name="crowdLevel"
            defaultValue={venue.crowdLevel ?? "Mellow"}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="Low">Low</option>
            <option value="Mellow">Mellow</option>
            <option value="Moderate">Moderate</option>
            <option value="Busy">Busy</option>
            <option value="Packed">Packed</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-zinc-100">
            <input type="checkbox" name="isLive" defaultChecked={Boolean(venue.isLive)} className="h-4 w-4 accent-cyan-500" />
            Live now
          </label>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            Save venue
          </button>
        </div>
      </form>
    </section>
  );
}
