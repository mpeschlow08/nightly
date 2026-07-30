"use client";

import Link from "next/link";

import type { ConsumerVenueCard } from "@/lib/consumer/types";

type ExploreMiniMapPreviewProps = {
  venues: ConsumerVenueCard[];
  selectedVenueId: number | null;
  onSelectVenue: (venueId: number) => void;
};

function pseudoMapPosition(id: number) {
  const xSeed = (id * 37) % 100;
  const ySeed = (id * 53) % 100;

  return {
    xPercent: 14 + (xSeed % 72),
    yPercent: 18 + (ySeed % 62),
  };
}

export default function ExploreMiniMapPreview({
  venues,
  selectedVenueId,
  onSelectVenue,
}: ExploreMiniMapPreviewProps) {
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? venues[0] ?? null;

  return (
    <section className="mx-auto mt-5 max-w-3xl px-4 sm:px-5 lg:px-6">
      <div className="overflow-hidden rounded-[1.3rem] border border-white/10 bg-[linear-gradient(160deg,_rgba(8,12,22,0.96),_rgba(4,7,14,0.94))] shadow-[0_20px_58px_rgba(0,0,0,0.42)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-medium text-zinc-200">Nearby Tonight</p>
          <Link
            href="/map"
            className="nightly-btn-secondary rounded-full border border-violet-300/35 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100"
          >
            Expand Map
          </Link>
        </div>

        <div className="relative h-44 overflow-hidden bg-[#070b16]">
          <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(34,211,238,0.18),transparent_35%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:26px_26px]" />

          {venues.map((venue) => {
            const active = selectedVenueId === venue.id;

            return (
              <button
                key={venue.id}
                type="button"
                onClick={() => onSelectVenue(venue.id)}
                className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition ${
                  active
                    ? "scale-110 border-white bg-violet-400 shadow-[0_0_18px_rgba(168,85,247,0.8)]"
                    : "border-violet-200/80 bg-violet-500"
                }`}
                style={{
                  left: `${pseudoMapPosition(venue.id).xPercent}%`,
                  top: `${pseudoMapPosition(venue.id).yPercent}%`,
                }}
                aria-label={`Select ${venue.name}`}
              />
            );
          })}
        </div>

        {selectedVenue ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{selectedVenue.name}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{selectedVenue.neighborhood} • {selectedVenue.distanceLabel ?? "Distance unavailable"}</p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {selectedVenue.genre}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
