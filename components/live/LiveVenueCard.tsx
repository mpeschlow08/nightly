import Link from "next/link";

import VenueImage from "@/components/media/VenueImage";
import type { ConsumerVenueCard } from "@/lib/consumer/types";

type Props = {
  venue: ConsumerVenueCard;
};

export default function LiveVenueCard({ venue }: Props) {
  return (
    <article className="nightly-card nightly-card-interactive relative min-w-[17.8rem] snap-start overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#080b16]">
      <div className="relative">
        <VenueImage src={venue.heroImageUrl} alt={`${venue.name} live`} orientation="portrait" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/35 to-transparent" />

        <div className="absolute inset-x-0 top-0 p-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-500/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-100">
            <span className="h-2 w-2 rounded-full bg-rose-200 shadow-[0_0_0_5px_rgba(251,113,133,0.24)]" />
            {venue.liveLabel ?? "LIVE"}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-3 p-4">
          <div>
            <p className="text-lg font-semibold text-white">{venue.name}</p>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/12 bg-black/30 p-2.5">
              <dt className="text-zinc-400">Crowd</dt>
              <dd className="mt-1 font-medium text-white">{venue.crowdLevel ?? "Unknown"}</dd>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/30 p-2.5">
              <dt className="text-zinc-400">Genre</dt>
              <dd className="mt-1 font-medium text-white">{venue.genre}</dd>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/30 p-2.5">
              <dt className="text-zinc-400">Status</dt>
              <dd className="mt-1 font-medium text-white">{venue.liveStatusProvenance.replace("_", " ")}</dd>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/30 p-2.5">
              <dt className="text-zinc-400">Distance</dt>
              <dd className="mt-1 font-medium text-white">{venue.distanceLabel ?? "--"}</dd>
            </div>
          </dl>

          <Link
            href={venue.href}
            className="nightly-btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-semibold text-white"
          >
            View Venue
          </Link>
        </div>
      </div>
    </article>
  );
}
