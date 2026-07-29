"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import DiscoverVenueCard from "@/components/DiscoverVenueCard";
import { discoverVenues } from "@/data/nightly";

export default function TrendingVenuesSection() {
  const trendingVenues = useMemo(
    () =>
      [...discoverVenues]
        .sort((a, b) => b.vibeScore - a.vibeScore)
        .slice(0, 3),
    []
  );
  const [savedVenueIds, setSavedVenueIds] = useState<number[]>([]);

  const toggleSavedVenue = (venueId: number) => {
    setSavedVenueIds((current) =>
      current.includes(venueId)
        ? current.filter((id) => id !== venueId)
        : [...current, venueId]
    );
  };

  return (
    <section id="trending-venues" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-violet-300/80">Momentum</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Trending Venues</h2>
        </div>
        <Link
          href="/discover"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/50 hover:text-white"
        >
          Explore all
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {trendingVenues.map((venue) => (
          <DiscoverVenueCard
            key={venue.id}
            venue={venue}
            isSaved={savedVenueIds.includes(venue.id)}
            onToggleSave={() => toggleSavedVenue(venue.id)}
          />
        ))}
      </div>
    </section>
  );
}
