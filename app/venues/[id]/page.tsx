import Link from "next/link";
import { notFound } from "next/navigation";

import {
  dayLabels,
  getVenueBusinessHours,
  getVenueById,
  getVenueHoursStatus,
  getVenueImages,
  normalizeBusinessHours,
} from "@/app/api/venues/lib/venues";
import TonightsPulse from "@/components/venue/TonightsPulse";
import VenueImageGallery from "@/components/venue/VenueImageGallery";

export default function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  return <VenueContent params={params} />;
}

async function VenueContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number.parseInt(id, 10);

  if (Number.isNaN(venueId)) {
    notFound();
  }

  const venue = await getVenueById(venueId);

  if (!venue) {
    notFound();
  }

  const venueImages = await getVenueImages(venue.id);
  const businessHours = await getVenueBusinessHours(venue.id).catch(() => []);
  const normalizedHours = normalizeBusinessHours(businessHours);
  const todayIndex = new Date().getDay();
  const hoursStatus = getVenueHoursStatus(normalizedHours);

  const genre = venue.genres?.[0] ?? "Genre coming soon";
  const description = venue.tagline ?? "Description coming soon.";
  const address = venue.neighborhood && venue.city ? `${venue.neighborhood}, ${venue.city}` : venue.city ?? "Address coming soon";
  const openingHours = `${dayLabels[todayIndex]}: ${hoursStatus.todayHoursLabel}`;
  const coverCharge = venue.cover != null ? `$${venue.cover}` : "Cover not available";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_40%),linear-gradient(135deg,_#05070c_0%,_#090b12_45%,_#0b1020_100%)] text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Venue Details</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{venue.name}</h1>
              <p className="mt-3 text-base text-zinc-300">{venue.tagline ?? "Tagline coming soon"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/50 hover:text-cyan-100">
                Get Directions
              </button>
              <button type="button" className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                Share
              </button>
              <button type="button" className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                Save
              </button>
              <Link href="/" className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                Back home
              </Link>
            </div>
          </div>

          <VenueImageGallery
            imageClass={venue.imageClass}
            images={venueImages.map((image) => ({ id: image.id, imageUrl: image.imageUrl }))}
          />

          <TonightsPulse venueId={venue.id} crowdLevel={venue.crowdLevel} isLive={venue.isLive} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">City</p>
              <p className="mt-2 text-base font-medium text-white">{venue.city ?? "City coming soon"}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Genre</p>
              <p className="mt-2 text-base font-medium text-white">{genre}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Tagline</p>
              <p className="mt-2 text-base font-medium text-white">{venue.tagline ?? "Tagline coming soon"}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Crowd level</p>
              <p className="mt-2 text-base font-medium text-white">{venue.crowdLevel ?? "Crowd level coming soon"}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Cover charge</p>
              <p className="mt-2 text-base font-medium text-white">{coverCharge}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Opening hours</p>
              <p className="mt-2 text-base font-medium text-white">{openingHours}</p>
              <p className={`mt-2 text-sm ${hoursStatus.isOpenNow ? "text-emerald-300" : "text-zinc-300"}`}>{hoursStatus.statusLabel}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Description</p>
              <p className="mt-2 text-base leading-7 text-zinc-200">{description}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Address</p>
              <p className="mt-2 text-base font-medium text-white">{address}</p>
            </article>
            <article className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Tonight&apos;s Vibe</p>
              <p className="mt-2 text-base leading-7 text-zinc-200">
                {venue.crowdLevel ? `${venue.crowdLevel} energy with a ${genre.toLowerCase()} lean tonight.` : "Tonight's energy details are coming soon."}
              </p>
            </article>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-[1.25rem] border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Upcoming Events</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Event lineup will appear here soon.
              </p>
            </section>
            <section className="rounded-[1.25rem] border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Live Cameras</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Live camera feeds will appear here when available.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
