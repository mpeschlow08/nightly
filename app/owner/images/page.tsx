import { notFound } from "next/navigation";

import {
  addOwnerVenueImageAction,
  deleteOwnerVenueImageAction,
  moveOwnerVenueImageAction,
  setOwnerVenueCoverImageAction,
} from "../actions";
import { getOwnerVenue, getOwnerVenueImages } from "../lib/data";
import { OwnerBlobImageUpload } from "@/components/owner/OwnerBlobImageUpload";

type OwnerImagesPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function OwnerImagesPage({ searchParams }: OwnerImagesPageProps) {
  const [{ venueId, venue }, images, params] = await Promise.all([
    getOwnerVenue(),
    getOwnerVenueImages(),
    searchParams,
  ]);

  if (!venue) {
    notFound();
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Image Management</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{venue.name} Gallery</h2>

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

      <OwnerBlobImageUpload venueId={venueId} />

      <form action={addOwnerVenueImageAction} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <input type="hidden" name="venueId" value={venueId} />
        <label htmlFor="owner-image-url" className="text-sm font-medium text-zinc-200">
          Add image URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="owner-image-url"
            name="imageUrl"
            type="url"
            required
            placeholder="https://example.com/venue-image.jpg"
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
          <button type="submit" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            Add image
          </button>
        </div>
      </form>

      {images.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          No images yet. Add your first image URL above.
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {images.map((image, index) => (
            <article key={image.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[100px_1fr_auto] lg:items-center">
              <div className="relative">
                <img
                  src={image.imageUrl}
                  alt={`Venue image ${index + 1}`}
                  className="h-24 w-full rounded-xl object-cover lg:w-24"
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full border border-amber-300/60 bg-amber-500/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-950">
                    Cover
                  </span>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Sort #{image.sortOrder}</p>
                <p className="mt-2 break-all text-sm text-zinc-200">{image.imageUrl}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={setOwnerVenueCoverImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <button
                    type="submit"
                    disabled={index === 0}
                    className="rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {index === 0 ? "Cover photo" : "Make cover"}
                  </button>
                </form>
                <form action={moveOwnerVenueImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={index === 0}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Move up
                  </button>
                </form>
                <form action={moveOwnerVenueImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === images.length - 1}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Move down
                  </button>
                </form>
                <form action={deleteOwnerVenueImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <button type="submit" className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    Delete
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
