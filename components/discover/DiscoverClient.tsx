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
import NightlyEmptyState from "@/components/nightly/NightlyEmptyState";
import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import type { ExploreDataPayload } from "@/lib/consumer/types";
import { trackDiscoveryInteraction } from "@/lib/discovery/analytics-client";

const QUICK_FILTERS = [
  "Live Now",
  "Trending",
  "No Cover",
  "Has Special Guest",
  "Artists",
  "Celebrities",
  "Influencers",
  "Athletes",
  "Hosts",
  "Tonight",
  "This Weekend",
  "Hip-Hop",
  "House",
  "Afrobeats",
  "Downtown",
];
const SORT_OPTIONS = ["recommended", "trending", "distance", "rating", "starting-soon"] as const;

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function inGuestTerms(terms: string[] | undefined, value: string) {
  const target = normalize(value);
  return (terms ?? []).some((term) => normalize(term).includes(target));
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
        [venue.name, venue.neighborhood, venue.genre, ...venue.genres, ...(venue.specialGuestSearchTerms ?? [])].join(" ")
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

          if (chip === "has special guest") {
            return Boolean(venue.specialGuestHighlight);
          }

          if (chip === "artists") {
            return inGuestTerms(venue.specialGuestSearchTerms, "artist");
          }

          if (chip === "celebrities") {
            return inGuestTerms(venue.specialGuestSearchTerms, "celebrity");
          }

          if (chip === "influencers") {
            return inGuestTerms(venue.specialGuestSearchTerms, "influencer");
          }

          if (chip === "athletes") {
            return inGuestTerms(venue.specialGuestSearchTerms, "athlete");
          }

          if (chip === "hosts") {
            return inGuestTerms(venue.specialGuestSearchTerms, "host");
          }

          if (chip === "tonight") {
            return normalize(venue.specialGuestHighlight?.badge ?? "") === "tonight";
          }

          if (chip === "this weekend") {
            return inGuestTerms(venue.specialGuestSearchTerms, "friday") || inGuestTerms(venue.specialGuestSearchTerms, "saturday") || inGuestTerms(venue.specialGuestSearchTerms, "sunday");
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
      const eventSearch = normalize([event.name, event.venueName, event.neighborhood, ...event.genres, ...(event.specialGuestSearchTerms ?? [])].join(" "));
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

          if (chip === "has special guest") {
            return Boolean(event.specialGuestHighlight);
          }

          if (chip === "artists") {
            return inGuestTerms(event.specialGuestSearchTerms, "artist");
          }

          if (chip === "celebrities") {
            return inGuestTerms(event.specialGuestSearchTerms, "celebrity");
          }

          if (chip === "influencers") {
            return inGuestTerms(event.specialGuestSearchTerms, "influencer");
          }

          if (chip === "athletes") {
            return inGuestTerms(event.specialGuestSearchTerms, "athlete");
          }

          if (chip === "hosts") {
            return inGuestTerms(event.specialGuestSearchTerms, "host");
          }

          if (chip === "tonight") {
            return normalize(event.specialGuestHighlight?.badge ?? "") === "tonight";
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

  const liveNowVenues = useMemo(
    () => sortedVenues.filter((venue) => venue.isLive),
    [sortedVenues]
  );

  const specialGuestVenues = useMemo(
    () => sortedVenues.filter((venue) => Boolean(venue.specialGuestHighlight)),
    [sortedVenues]
  );

  const mapPreviewVenues = useMemo(
    () => (sortedVenues.length > 0 ? sortedVenues.slice(0, 6) : initialData.venues.slice(0, 6)),
    [sortedVenues, initialData.venues]
  );

  const noResults = sortedVenues.length === 0 && sortedEvents.length === 0;

  return (
    <div className="nightly-page overflow-x-hidden">
      <div className="nightly-page-shell overflow-hidden">
        <main className="relative mx-auto max-w-6xl pb-28 pt-2 lg:pb-12">
          <section className="nightly-nav-blur sticky top-0 z-30 border-b border-[color:var(--border)] px-4 py-3 sm:px-5 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.66rem] uppercase tracking-[0.24em] text-violet-200/80">Discover</p>
                <h1 className="nightly-page-title">Find Your Vibe</h1>
              </div>
              <span className="rounded-full border border-[color:var(--border)] bg-white/5 px-3 py-1 text-xs text-[color:var(--text-secondary)]">Atlanta</span>
            </div>
          </section>

          <section className="mt-3">
            <ExploreSearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              onOpenFilters={() => setSelectedFilters((current) => (current.length > 0 ? [] : ["Live Now"]))}
            />
            <div className="mx-auto mt-2 flex items-center gap-2 px-4 sm:px-5 lg:px-8">
              <label className="text-xs text-[color:var(--text-muted)]" htmlFor="discover-sort">Sort</label>
              <select
                id="discover-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as (typeof SORT_OPTIONS)[number])}
                className="rounded-full border border-[color:var(--border)] bg-white/5 px-3 py-1 text-xs text-[color:var(--text-secondary)]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#060a14] capitalize">
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

          <section className="mx-auto mt-4 px-4 sm:px-5 lg:px-8">
            <div className="nightly-surface-elevated p-4 sm:p-5">
              <p className="text-[0.66rem] uppercase tracking-[0.2em] text-cyan-200/80">AI City Pulse</p>
              <h2 className="nightly-section-title mt-1">{initialData.cityPulse.headline}</h2>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{initialData.cityPulse.summary}</p>
            </div>
          </section>

          {noResults ? (
            <section className="mx-auto mt-5 px-4 sm:px-5 lg:px-8">
              <NightlyEmptyState
                eyebrow="No matches"
                title="No venues or events match this filter set"
                description="Try fewer filters or a broader search term to discover more nightlife options."
                secondaryAction={{
                  label: "Reset filters",
                  onClick: () => {
                    setQuery("");
                    setSelectedFilters([]);
                    setSortBy("recommended");
                  },
                }}
              />
            </section>
          ) : null}

          <ExploreMiniMapPreview
            venues={mapPreviewVenues}
            selectedVenueId={selectedMapVenueId}
            onSelectVenue={setSelectedMapVenueId}
          />

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
            <NightlySectionHeader
              eyebrow="Tonight"
              title="Live Now"
              subtitle="Venues currently active across Nightly Live and event floors."
              href="/live"
            />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(liveNowVenues.length > 0 ? liveNowVenues : sortedVenues.slice(0, 6)).map((venue, index) => (
                <VenueDiscoveryCard key={`live-venue-${venue.id}`} venue={venue} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
            <NightlySectionHeader
              eyebrow="Exclusive"
              title="Special Guests"
              subtitle="Prominent guest appearances happening tonight."
              href="/discover"
            />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(specialGuestVenues.length > 0 ? specialGuestVenues : sortedVenues.slice(0, 6)).map((venue, index) => (
                <VenueDiscoveryCard key={`guest-venue-${venue.id}`} venue={venue} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
            <ExploreSectionHeader title="Trending Venues" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(trendingVenues.length > 0 ? trendingVenues : sortedVenues.slice(0, 6)).map((venue, index) => (
                <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
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
                  specialGuestHighlight={event.specialGuestHighlight ?? null}
                  reason={event.recommendationReason}
                  animationDelayMs={index * 45}
                />
              ))}
            </div>
          </section>

          {initialData.friendsInterestedVenues.length > 0 ? (
            <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
              <ExploreSectionHeader title="Friends Are Interested" href="/crews" />
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
                {initialData.friendsInterestedVenues.map((venue, index) => (
                  <VenueDiscoveryCard key={`friend-venue-${venue.id}`} venue={venue} animationDelayMs={index * 45} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
            <ExploreSectionHeader title="Featured DJs" href="/events" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredDjs.length > 0 ? filteredDjs : initialData.djs).map((dj, index) => (
                <ExploreDjCard key={dj.id} dj={dj} animationDelayMs={index * 45} />
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
            <ExploreSectionHeader title="Categories" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredCategories.length > 0 ? filteredCategories : initialData.categories).map((category, index) => (
                <Link
                  key={category.id}
                  href={category.href}
                  className="nightly-card nightly-card-interactive nightly-fade-in relative min-w-[16rem] snap-start overflow-hidden rounded-[1.2rem]"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <NightlyImage src={category.imageUrl} alt={`${category.name} cover`} ratio="landscape" sizes="(max-width: 640px) 80vw, 280px" className="rounded-none" />
                  <div className="nightly-image-overlay absolute inset-0" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="text-base font-semibold text-white">{category.name}</h3>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{category.subtitle}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 px-4 sm:px-5 lg:px-8">
            <ExploreSectionHeader title="Neighborhood Collections" href="/discover" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
              {(filteredNeighborhoods.length > 0 ? filteredNeighborhoods : initialData.neighborhoods).map((neighborhood, index) => (
                <Link
                  key={neighborhood.id}
                  href={neighborhood.href}
                  className="nightly-card nightly-card-interactive nightly-fade-in relative min-w-[16.8rem] snap-start overflow-hidden rounded-[1.2rem]"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <NightlyImage src={neighborhood.imageUrl} alt={`${neighborhood.name} nightlife`} ratio="landscape" sizes="(max-width: 640px) 82vw, 300px" className="rounded-none" />
                  <div className="nightly-image-overlay absolute inset-0" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="text-base font-semibold text-white">{neighborhood.name}</h3>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{neighborhood.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 px-4 pb-6 sm:px-5 lg:px-8">
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
