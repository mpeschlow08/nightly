import Link from "next/link";

import type { ConsumerVenueCard } from "@/lib/consumer/types";

type Props = {
  venue: ConsumerVenueCard;
};

export default function LivePreviewCard({ venue }: Props) {
  const signalLabel = venue.liveLabel === "CAMERA LIVE"
    ? "Camera-ready signal"
    : venue.liveLabel === "EVENT LIVE"
      ? "Event-live signal"
      : venue.liveLabel === "OPEN NOW"
        ? "Open-now signal"
        : "Live nightlife signal";

  return (
    <article className="nightly-card min-w-[16.8rem] snap-start rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="rounded-xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/12 to-black/35 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/45 bg-rose-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-200" />
            Live
          </span>
          <p className="text-[10px] text-zinc-300">{venue.liveStatusProvenance.replace("_", " ")}</p>
        </div>

        <div className="mt-5 rounded-lg border border-white/15 bg-black/35 p-3 text-xs text-zinc-300">
          <p className="font-semibold text-zinc-100">{signalLabel}</p>
          <p className="mt-1">Tap through to see venue details, lineup context, and reservation options.</p>
        </div>

        <p className="mt-3 text-xs font-medium text-white">{venue.liveLabel ?? "Live feed"}</p>
        <p className="text-[11px] text-zinc-400">{venue.name}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={venue.href} className="nightly-btn-secondary inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 bg-black/25 px-3 text-xs font-semibold text-zinc-100">
          Open Venue
        </Link>
        <Link href="/bookings" className="nightly-btn-secondary inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 bg-black/25 px-3 text-xs font-semibold text-zinc-100">
          Reserve
        </Link>
      </div>
    </article>
  );
}
