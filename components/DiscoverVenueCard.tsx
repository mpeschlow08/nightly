import Link from "next/link";

import VenueImage from "@/components/media/VenueImage";
import type { DiscoverVenue } from "@/data/nightly";

type DiscoverVenueCardProps = {
  venue: DiscoverVenue;
  isSaved: boolean;
  onToggleSave: () => void;
};

export default function DiscoverVenueCard({ venue, isSaved, onToggleSave }: DiscoverVenueCardProps) {
  const crowdTone =
    venue.crowdLevel === "Packed"
      ? "bg-rose-400"
      : venue.crowdLevel === "Buzzing"
        ? "bg-cyan-400"
        : venue.crowdLevel === "High"
          ? "bg-violet-400"
          : "bg-emerald-400";

  return (
    <article className="nightly-card nightly-card-interactive group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="relative">
        <VenueImage src={venue.thumbnailImage || venue.heroImage} alt={`${venue.name} venue`} orientation="horizontal" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        {venue.isLive ? (
          <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
            {venue.badge ?? "LIVE"}
          </div>
        ) : null}

        <div className="absolute right-4 top-4 flex gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            className="nightly-btn-secondary rounded-full border border-white/20 bg-black/35 px-3 py-2 text-sm text-white hover:text-cyan-200"
            aria-label={isSaved ? `Remove ${venue.name} from saved` : `Save ${venue.name}`}
          >
            {isSaved ? "♥" : "♡"}
          </button>
          <button
            type="button"
            className="nightly-btn-secondary rounded-full border border-white/20 bg-black/35 px-3 py-2 text-sm text-white hover:text-cyan-200"
            aria-label={`Share ${venue.name}`}
          >
            ↗
          </button>
        </div>

        <div className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1 text-sm text-white backdrop-blur-sm">
          {venue.distanceMiles.toFixed(1)} mi away
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{venue.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">{venue.neighborhood}</p>
            <p className="mt-1 text-sm text-zinc-500">{venue.tagline}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-200">
            <span className={`h-2.5 w-2.5 rounded-full ${crowdTone} animate-pulse`} />
            {venue.crowdLevel}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
         {(venue.genres ?? []).map((genre) => (
  <span
    key={genre}
    className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
  >
    {genre}
  </span>
))}
        </div>

        <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Live DJ</span>
            <span className="font-medium text-white">{venue.liveDjName}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Cover</span>
            <span className="font-medium text-white">${venue.cover}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Open until</span>
            <span className="font-medium text-white">{venue.openUntil}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Vibe score</span>
            <span className="font-medium text-white">{venue.vibeScore}/100</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Wait</span>
            <span className="font-medium text-white">{venue.waitTime}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Checked in</span>
            <span className="font-medium text-white">{venue.checkedIn}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/venues/${venue.slug}`}
            className="nightly-btn-secondary flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-medium text-zinc-100 hover:bg-white/10"
          >
            View Details
          </Link>
          <button
            type="button"
            className="nightly-btn-primary flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-center text-sm font-medium text-white hover:opacity-90"
          >
            Share
          </button>
        </div>
      </div>
    </article>
  );
}
