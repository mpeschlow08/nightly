"use client";

import Link from "next/link";
import { useState } from "react";

import VenueImage from "@/components/media/VenueImage";
import type { ConsumerVenueCard } from "@/lib/consumer/types";

type VenueDiscoveryCardProps = {
  venue: ConsumerVenueCard;
  animationDelayMs?: number;
};

const crowdToneByLevel: Record<string, string> = {
  Mellow: "bg-emerald-400/85",
  Steady: "bg-sky-400/85",
  Buzzing: "bg-cyan-300/85",
  Packed: "bg-rose-400/85",
};

export default function VenueDiscoveryCard({
  venue,
  animationDelayMs = 0,
}: VenueDiscoveryCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <article
      className="nightly-card nightly-card-interactive nightly-fade-in group relative min-h-[18.8rem] min-w-[17.2rem] snap-start overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#050912] shadow-[0_20px_54px_rgba(0,0,0,0.42)] active:scale-[0.99] sm:min-w-[18.2rem]"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="relative overflow-hidden">
        <VenueImage src={venue.thumbnailImageUrl || venue.heroImageUrl} alt={`${venue.name} nightlife scene`} orientation="portrait" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {venue.isLive ? (
          <span className="absolute left-3 top-3 rounded-full border border-rose-300/40 bg-rose-500/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-rose-100">
            LIVE
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => setIsFavorite((value) => !value)}
          aria-label={isFavorite ? `Unfavorite ${venue.name}` : `Favorite ${venue.name}`}
          className="nightly-btn-secondary absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/45 text-sm text-white backdrop-blur"
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="space-y-2.5 p-3.5">
        <div>
          <h3 className="line-clamp-1 text-[1.02rem] font-semibold tracking-tight text-white">
            <Link href={venue.href} className="focus-visible:outline-none">
              {venue.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">{venue.neighborhood}</p>
        </div>

        <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
              {venue.genre}
            </span>
            <span className="text-xs text-zinc-300">{venue.distanceLabel ?? venue.neighborhood}</span>
        </div>

        {venue.crowdLevel ? (
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className={`h-2.5 w-2.5 rounded-full ${crowdToneByLevel[venue.crowdLevel] ?? "bg-zinc-400/80"}`} />
            <span>{venue.crowdLevel} crowd</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
