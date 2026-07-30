"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ExploreDjCard from "@/components/explore/ExploreDjCard";
import ExploreFilterChips from "@/components/explore/ExploreFilterChips";
import ExploreMiniMapPreview from "@/components/explore/ExploreMiniMapPreview";
import ExploreSearchBar from "@/components/explore/ExploreSearchBar";
import ExploreSectionHeader from "@/components/explore/ExploreSectionHeader";
import NightlyImage from "@/components/media/NightlyImage";
import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import type { ExploreDataPayload } from "@/lib/consumer/types";
import { trackDiscoveryInteraction } from "@/lib/discovery/analytics-client";

const QUICK_FILTERS = ["Live Now", "Trending", "No Cover", "Hip-Hop", "House", "Afrobeats", "Downtown"];
const SORT_OPTIONS = ["recommended", "trending", "distance", "rating", "starting-soon"] as const;

function normalize(value: string) {
  return value.toLowerCase().trim();
}

type DiscoverClientProps = {
  initialData: ExploreDataPayload;
};

export default function DiscoverClient({ initialData }: DiscoverClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>(
    (searchParams.get("sort") as (typeof SORT_OPTIONS)[number]) ?? "recommended"
  );
  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    searchParams.get("filters")?.split(",").filter(Boolean) ?? ["Live Now"]
  );
  const [selectedMapVenueId, setSelectedMapVenueId] = useState<number | null>(initialData.venues[0]?.id ?? null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }

    if (selectedFilters.length > 0) {
      params.set("filters", selectedFilters.join(","));
    } else {
      params.delete("filters");
    }

    params.set("sort", sortBy);

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(`/discover?${next}`);
    }
  }, [query, selectedFilters, sortBy, router, searchParams]);

  useEffect(() => {
    void trackDiscoveryInteraction({
      event: "filter_applied",
      recommendationType: "discover",
      explanationCategory: sortBy,
      activeFilters: selectedFilters,
    });
  }, [selectedFilters, sortBy]);

  useEffect(() => {
    void trackDiscoveryInteraction({
      event: "city_pulse_opened",
      recommendationType: "discover",
    });
  }, []);

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

  const sortedVenues = useMemo(() => {
    return [...filteredVenues].sort((a, b) => {
      if (sortBy === "distance") {
        const parse = (value: string | null) => Number.parseFloat(value?.replace(/[^\d.]/g, "") || "999");
        return parse(a.distanceLabel) - parse(b.distanceLabel);
      }

      if (sortBy === "trending") {
        return Number(b.liveLabel === "TRENDING") - Number(a.liveLabel === "TRENDING") || Number(b.isLive) - Number(a.isLive);
      }

      if (sortBy === "rating") {
        return Number(b.recommendationReasonCode === "top-rated") - Number(a.recommendationReasonCode === "top-rated");
      }

      return Number(b.isLive) - Number(a.isLive);
    });
  }, [filteredVenues, sortBy]);

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

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      if (sortBy === "distance") {
        return (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999);
      }

      if (sortBy === "starting-soon") {
        return a.startTimeLabel.localeCompare(b.startTimeLabel);
      }

      if (sortBy === "trending") {
        return Number(b.recommendationReasonCode === "trending") - Number(a.recommendationReasonCode === "trending");
      }

      return Number(b.isLive) - Number(a.isLive);
    });
  }, [filteredEvents, sortBy]);

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
    () => (sortedVenues.length > 0 ? sortedVenues.slice(0, 6) : initialData.venues.slice(0, 6)),
    [sortedVenues, initialData.venues]
  );

  const trendingVenues = useMemo(
    () => sortedVenues.filter((venue) => venue.liveLabel === "TRENDING"),
    [sortedVenues]
  );

  const mapPreviewVenues = useMemo(
    () => (sortedVenues.length > 0 ? sortedVenues.slice(0, 6) : initialData.venues.slice(0, 6)),
    [sortedVenues, initialData.venues]
  );

  const noResults = sortedVenues.length === 0 && sortedEvents.length === 0;

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
            <div className="mx-auto mt-2 flex gap-2 px-4 sm:px-5 lg:px-6">
              <label className="text-xs text-zinc-400" htmlFor="discover-sort">Sort</label>
              <select
                id="discover-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as (typeof SORT_OPTIONS)[number])}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-200"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#060a14]">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <ExploreFilterChips
              chips={QUICK_FILTERS}
              selected={selectedFilters}
              onToggle={toggleFilter}
            />
          </section>

          <section className="mx-auto mt-4 px-4 sm:px-5 lg:px-6">
            <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">AI City Pulse</p>
              <h2 className="mt-1 text-base font-semibold text-white">{initialData.cityPulse.headline}</h2>
              <p className="mt-1 text-sm text-zinc-300">{initialData.cityPulse.summary}</p>
            </div>
          </section>

          {noResults ? (
            <section className="mx-auto mt-5 px-4 sm:px-5 lg:px-6">
              <div className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-zinc-200">No results match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedFilters([]);
                    setSortBy("recommended");
                  }}
                  className="mt-3 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200"
                >
                  Reset Filters
                </button>
              </div>
            </section>
          ) : null}

          <ExploreMiniMapPreview
            venues={mapPreviewVenues}
            selectedVenueId={selectedMapVenueId}
            onSelectVenue={setSelectedMapVenueId}
          />

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Trending Venues" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(trendingVenues.length > 0 ? trendingVenues : sortedVenues.slice(0, 6)).map((venue, index) => (
                <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
            <ExploreSectionHeader title="Events Near You" href="/events" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(sortedEvents.length > 0 ? sortedEvents : initialData.events.slice(0, 5)).map((event, index) => (
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
                  reason={event.recommendationReason}
                  animationDelayMs={index * 45}
                />
              ))}
            </div>
          </section>

          {initialData.friendsInterestedVenues.length > 0 ? (
            <section className="mx-auto mt-7 px-4 sm:px-5 lg:px-6">
              <ExploreSectionHeader title="Friends Are Interested" href="/crews" />
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
                {initialData.friendsInterestedVenues.map((venue, index) => (
                  <VenueDiscoveryCard key={`friend-venue-${venue.id}`} venue={venue} animationDelayMs={index * 45} />
                ))}
              </div>
            </section>
          ) : null}

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
