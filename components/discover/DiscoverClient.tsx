"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ExploreDjCard from "@/components/explore/ExploreDjCard";
import ExploreFilterChips from "@/components/explore/ExploreFilterChips";
import ExploreMiniMapPreview from "@/components/explore/ExploreMiniMapPreview";
import ExploreSearchBar from "@/components/explore/ExploreSearchBar";
import ExploreSectionHeader from "@/components/explore/ExploreSectionHeader";
import NightlyImage from "@/components/media/NightlyImage";
import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import type { ExploreDataPayload } from "@/lib/consumer/types";

const QUICK_FILTERS = ["Live Now", "Trending", "No Cover", "Hip-Hop", "House", "Afrobeats", "Downtown"];

function normalize(value: string) {
  return value.toLowerCase().trim();
}

type DiscoverClientProps = {
  initialData: ExploreDataPayload;
};

export default function DiscoverClient({ initialData }: DiscoverClientProps) {
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["Live Now"]);
  const [selectedMapVenueId, setSelectedMapVenueId] = useState<number | null>(initialData.venues[0]?.id ?? null);

  const toggleFilter = (chip: string) => {
    setSelectedFilters((current) =>
      current.includes(chip)
        ? current.filter((item) => item !== chip)
        : [...current, chip]
    );
  };

  const queryValue = normalize(query);

  const filteredVenues = useMemo(() => {
    const chips = selectedFilters.map(normalize);

    return initialData.venues.filter((venue) => {
      const venueSearch = normalize(
        [venue.name, venue.neighborhood, venue.genre, ...venue.genres].join(" ")
      );
      const matchesQuery = queryValue.length === 0 || venueSearch.includes(queryValue);

      const matchesChips =
        chips.length === 0 ||
        chips.some((chip) => {
          if (chip === "live now") {
            return venue.isLive;
          }

          if (chip === "trending") {
            return venue.liveLabel === "TRENDING";
          }

          if (chip === "no cover") {
            return false;
          }

          return venueSearch.includes(chip);
        });

      return matchesQuery && matchesChips;
    });
  }, [initialData.venues, queryValue, selectedFilters]);

  const filteredEvents = useMemo(() => {
    const chips = selectedFilters.map(normalize);

    return initialData.events.filter((event) => {
      const eventSearch = normalize([event.name, event.venueName, event.neighborhood, ...event.genres].join(" "));
      const matchesQuery =
        queryValue.length === 0 ||
        eventSearch.includes(queryValue) ||
        event.ticketStatus.toLowerCase().includes(queryValue);

      const matchesChips =
        chips.length === 0 ||
        chips.some((chip) => {
          if (chip === "live now") {
            return event.isLive;
          }

          if (chip === "no cover") {
            return event.cover <= 0;
          }

          if (chip === "trending") {
            return event.ticketStatus !== "Sold out";
          }

          return eventSearch.includes(chip);
        });

      return matchesQuery && matchesChips;
    });
  }, [initialData.events, queryValue, selectedFilters]);

  const filteredDjs = useMemo(() => {
    const chips = selectedFilters.map(normalize);

    return initialData.djs.filter((dj) => {
      const djSearch = normalize([dj.name, dj.performingAt ?? "", ...dj.genres].join(" "));
      const matchesQuery = queryValue.length === 0 || djSearch.includes(queryValue);
      const matchesChips =
        chips.length === 0 ||
        chips.some((chip) => {
          if (chip === "live now") {
            return dj.isPerformingTonight;
          }

          return djSearch.includes(chip);
        });

      return matchesQuery && matchesChips;
    });
  }, [initialData.djs, queryValue, selectedFilters]);

  const filteredNeighborhoods = useMemo(
    () =>
      initialData.neighborhoods.filter((item) => {
        const haystack = normalize(`${item.name} ${item.summary}`);
        return queryValue.length === 0 || haystack.includes(queryValue);
      }),
    [initialData.neighborhoods, queryValue]
  );

  const filteredCategories = useMemo(
    () =>
      initialData.categories.filter((item) => {
        const haystack = normalize(`${item.name} ${item.subtitle}`);
        return queryValue.length === 0 || haystack.includes(queryValue);
      }),
    [initialData.categories, queryValue]
  );

  const recentlyViewed = useMemo(
    () => (filteredVenues.length > 0 ? filteredVenues.slice(0, 6) : initialData.venues.slice(0, 6)),
    [filteredVenues, initialData.venues]
  );

  const trendingVenues = useMemo(
    () => filteredVenues.filter((venue) => venue.liveLabel === "TRENDING"),
    [filteredVenues]
  );

  const mapPreviewVenues = useMemo(
    () => (filteredVenues.length > 0 ? filteredVenues.slice(0, 6) : initialData.venues.slice(0, 6)),
    [filteredVenues, initialData.venues]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,40,90,0.22),_transparent_32%),radial-gradient(circle_at_85%_10%,_rgba(139,92,246,0.18),_transparent_25%)]" />

        <main className="relative mx-auto max-w-3xl pb-24 pt-2">
          <section className="sticky top-0 z-30 border-b border-white/10 bg-[#04070b]/90 px-4 py-3 backdrop-blur-xl sm:px-5 lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-violet-200/80">Explore</p>
                <h1 className="text-lg font-semibold tracking-tight text-white">Find Your Night</h1>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">Atlanta</span>
            </div>
          </section>

          <section className="mt-3">
            <ExploreSearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              onOpenFilters={() => setSelectedFilters((current) => (current.length > 0 ? [] : ["Live Now"]))}
            />
            <ExploreFilterChips
              chips={QUICK_FILTERS}
              selected={selectedFilters}
              onToggle={toggleFilter}
            />
          </section>

          <ExploreMiniMapPreview
            venues={mapPreviewVenues}
            selectedVenueId={selectedMapVenueId}
            onSelectVenue={setSelectedMapVenueId}
          />

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Trending Venues" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(trendingVenues.length > 0 ? trendingVenues : initialData.venues.slice(0, 6)).map((venue, index) => (
                <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Events Near You" href="/events" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredEvents.length > 0 ? filteredEvents : initialData.events.slice(0, 5)).map((event, index) => (
                <EventDiscoveryCard
                  key={event.id}
                  href={event.href}
                  name={event.name}
                  venueName={event.venueName}
                  neighborhood={event.neighborhood}
                  startTime={event.startTimeLabel}
                  ticketStatus={event.ticketStatus}
                  imageUrl={event.imageUrl}
                  isLive={event.isLive}
                  animationDelayMs={index * 45}
                />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Featured DJs" href="/events" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredDjs.length > 0 ? filteredDjs : initialData.djs).map((dj, index) => (
                <ExploreDjCard key={dj.id} dj={dj} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Categories" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredCategories.length > 0 ? filteredCategories : initialData.categories).map((category, index) => (
                <Link
                  key={category.id}
                  href={category.href}
                  className="nightly-card nightly-card-interactive nightly-fade-in relative min-w-[16rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#060a14]"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <NightlyImage src={category.imageUrl} alt={`${category.name} cover`} ratio="landscape" sizes="(max-width: 640px) 80vw, 280px" className="rounded-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="text-base font-semibold text-white">{category.name}</h3>
                    <p className="mt-1 text-xs text-zinc-300">{category.subtitle}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Neighborhood Collections" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredNeighborhoods.length > 0 ? filteredNeighborhoods : initialData.neighborhoods).map((neighborhood, index) => (
                <Link
                  key={neighborhood.id}
                  href={neighborhood.href}
                  className="nightly-card nightly-card-interactive nightly-fade-in relative min-w-[16.8rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#060a14]"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <NightlyImage src={neighborhood.imageUrl} alt={`${neighborhood.name} nightlife`} ratio="landscape" sizes="(max-width: 640px) 82vw, 300px" className="rounded-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/24 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="text-base font-semibold text-white">{neighborhood.name}</h3>
                    <p className="mt-1 text-xs text-zinc-300">{neighborhood.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-7 px-4 pb-6 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Recently Viewed" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {recentlyViewed.map((venue, index) => (
                <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
