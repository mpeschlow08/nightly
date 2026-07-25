import { notFound } from "next/navigation";

import { updateOwnerVenueAction } from "../actions";
import { getOwnerVenue } from "../lib/data";
import { OwnerBlobImageUpload } from "@/components/owner/OwnerBlobImageUpload";

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
      <p className="mt-2 text-sm text-zinc-300">Update consumer-facing venue fields for your mock-owner venue.</p>

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

        <div>
          <label htmlFor="owner-venue-genre" className="text-sm font-medium text-zinc-200">
            Genre
          </label>
          <input
            id="owner-venue-genre"
            name="genre"
            defaultValue={venue.genres?.[0] ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
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
