"use client";

import Link from "next/link";

import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import type { ConsumerVenueCard } from "@/lib/consumer/types";

type Props = {
  trendingVenues?: ConsumerVenueCard[];
};

export default function TrendingVenuesSection({ trendingVenues }: Props) {
  const venueCards = Array.isArray(trendingVenues) ? trendingVenues : [];

  return (
    <section id="trending-venues" className="mx-auto mt-7 max-w-3xl px-4 sm:px-5 lg:px-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Trending Venues</h2>
        <Link
          href="/discover"
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-300"
        >
          See All
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none]">
        {venueCards.map((venue, index) => (
          <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
        ))}
      </div>
    </section>
  );
}
