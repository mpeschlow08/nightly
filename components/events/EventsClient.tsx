"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import EventCard from "@/components/EventCard";
import NightlyButton from "@/components/nightly/NightlyButton";
import NightlyCard from "@/components/nightly/NightlyCard";
import NightlyChip from "@/components/nightly/NightlyChip";
import NightlyEmptyState from "@/components/nightly/NightlyEmptyState";
import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import type { ConsumerEventCard } from "@/lib/consumer/types";

type SortOption = "recommended" | "soonest" | "closest" | "lowest-cover";
type DateOption = "tonight" | "tomorrow" | "weekend" | "all";

const dateOptions: { key: DateOption; label: string }[] = [
  { key: "tonight", label: "Tonight" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "This Weekend" },
  { key: "all", label: "All" },
];

type EventsClientProps = {
  initialEvents: ConsumerEventCard[];
};

export default function EventsClient({ initialEvents }: EventsClientProps) {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<DateOption>("tonight");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [cover, setCover] = useState("any");
  const [distance, setDistance] = useState("any");
  const [crowd, setCrowd] = useState("any");
  const [age, setAge] = useState("any");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [ticketAvailableOnly, setTicketAvailableOnly] = useState(false);
  const [hasSpecialGuestOnly, setHasSpecialGuestOnly] = useState(false);
  const [guestTypes, setGuestTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");

  const toggleGuestType = (value: string) => {
    setGuestTypes((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const genres = useMemo(() => {
    const set = new Set<string>();

    for (const event of initialEvents) {
      for (const genre of event.genres) {
        set.add(genre);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [initialEvents]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) => (current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre]));
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedDate("tonight");
    setSelectedGenres([]);
    setCover("any");
    setDistance("any");
    setCrowd("any");
    setAge("any");
    setOpenNowOnly(false);
    setTicketAvailableOnly(false);
    setHasSpecialGuestOnly(false);
    setGuestTypes([]);
    setSortBy("recommended");
  };

  const filteredEvents = useMemo(() => {
    const matches = initialEvents.filter((event) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        [event.name, event.venueName, event.neighborhood, event.genres.join(" "), ...(event.specialGuestSearchTerms ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const label = event.dateLabel.toLowerCase();
      const matchesDate =
        selectedDate === "tonight"
          ? label.includes("tonight")
          : selectedDate === "tomorrow"
            ? label.includes("tomorrow")
            : selectedDate === "weekend"
              ? label.includes("weekend")
              : true;

      const matchesGenres = selectedGenres.length === 0 || selectedGenres.every((genre) => event.genres.includes(genre));
      const matchesCover = cover === "any" || (cover === "under-20" && event.cover <= 20) || (cover === "under-30" && event.cover <= 30) || (cover === "over-30" && event.cover > 30);
      const matchesDistance = distance === "any" || (distance === "under-2" && (event.distanceMiles ?? Number.MAX_SAFE_INTEGER) <= 2) || (distance === "under-5" && (event.distanceMiles ?? Number.MAX_SAFE_INTEGER) <= 5) || (distance === "over-5" && (event.distanceMiles ?? 0) > 5);
      const matchesCrowd = crowd === "any" || event.crowdLevel?.toLowerCase() === crowd.toLowerCase();
      const matchesAge = age === "any" || event.ageRequirementLabel === age;
      const matchesOpenNow = !openNowOnly || event.isLive;
      const matchesTicket = !ticketAvailableOnly || event.ticketStatus !== "Sold out";
      const matchesSpecialGuest = !hasSpecialGuestOnly || Boolean(event.specialGuestHighlight);
      const matchesGuestType =
        guestTypes.length === 0 ||
        guestTypes.some((type) => (event.specialGuestSearchTerms ?? []).some((term) => term.toLowerCase().includes(type.toLowerCase())));

      return matchesQuery && matchesDate && matchesGenres && matchesCover && matchesDistance && matchesCrowd && matchesAge && matchesOpenNow && matchesTicket && matchesSpecialGuest && matchesGuestType;
    });

    const sorted = [...matches];

    switch (sortBy) {
      case "soonest":
        sorted.sort((a, b) => a.startTimeLabel.localeCompare(b.startTimeLabel));
        break;
      case "closest":
        sorted.sort((a, b) => (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER));
        break;
      case "lowest-cover":
        sorted.sort((a, b) => a.cover - b.cover);
        break;
      case "recommended":
      default:
        sorted.sort((a, b) => Number(b.isLive) - Number(a.isLive) || (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER));
        break;
    }

    return sorted;
  }, [age, cover, crowd, distance, guestTypes, hasSpecialGuestOnly, initialEvents, openNowOnly, search, selectedDate, selectedGenres, sortBy, ticketAvailableOnly]);

  const heroStats = useMemo(() => {
    const liveNow = initialEvents.filter((event) => event.isLive).length;
    const specialGuest = initialEvents.filter((event) => Boolean(event.specialGuestHighlight)).length;
    const noCover = initialEvents.filter((event) => event.cover <= 0).length;

    return { liveNow, specialGuest, noCover };
  }, [initialEvents]);

  return (
    <div className="nightly-page min-h-screen antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_34%),radial-gradient(circle_at_92%_8%,_rgba(255,124,82,0.18),_transparent_28%)]" />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="nightly-surface-elevated p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[color:var(--text-muted)]">Events</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl lg:text-5xl">Find Your Night</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--text-secondary)]">
                  Filter by time, vibe, access, and special guests to match the room to your exact energy.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 self-start lg:min-w-[20rem]">
                <NightlyCard className="rounded-2xl p-3 text-center">
                  <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Live</p>
                  <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{heroStats.liveNow}</p>
                </NightlyCard>
                <NightlyCard className="rounded-2xl p-3 text-center">
                  <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Guests</p>
                  <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{heroStats.specialGuest}</p>
                </NightlyCard>
                <NightlyCard className="rounded-2xl p-3 text-center">
                  <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">No Cover</p>
                  <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{heroStats.noCover}</p>
                </NightlyCard>
              </div>
            </div>

            <div className="mt-7 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <label className="nightly-surface-subtle block rounded-2xl p-4">
                <span className="text-sm font-medium text-[color:var(--text-secondary)]">Search events</span>
                <input
                  id="event-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Event, venue, guest, or genre"
                  className="mt-2 w-full rounded-full border border-[color:var(--border)] bg-white/[0.05] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-zinc-500"
                />
              </label>
              <div className="nightly-surface-subtle rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--text-secondary)]">City pulse</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                  <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-sky-100">Atlanta</span>
                  <span>Curated from published records</span>
                </div>
                <Link href="/discover" className="mt-3 inline-flex text-sm text-sky-200 transition hover:text-sky-100">
                  Browse venues
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {dateOptions.map((option) => (
                <NightlyChip key={option.key} label={option.label} active={selectedDate === option.key} onClick={() => setSelectedDate(option.key)} />
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-black/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <NightlySectionHeader
                  title="Filters"
                  subtitle="Dial in by genre, budget, distance, and entry options."
                  className="mb-0"
                />
                <NightlyButton onClick={clearFilters} variant="secondary" className="min-h-10 px-4 py-2 text-sm">
                  Clear all
                </NightlyButton>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                <div>
                  <p className="mb-3 text-sm font-medium text-[color:var(--text-secondary)]">Genres</p>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => (
                      <NightlyChip key={genre} label={genre} active={selectedGenres.includes(genre)} onClick={() => toggleGenre(genre)} />
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="event-cover" className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Cover</label>
                  <select
                    id="event-cover"
                    value={cover}
                    onChange={(event) => setCover(event.target.value)}
                    className="w-full rounded-full border border-[color:var(--border)] bg-white/[0.05] px-3 py-2.5 text-sm text-[color:var(--text-primary)] outline-none"
                  >
                    <option value="any">Any cover</option>
                    <option value="under-20">Under $20</option>
                    <option value="under-30">Under $30</option>
                    <option value="over-30">$30+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="event-distance" className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Distance</label>
                  <select
                    id="event-distance"
                    value={distance}
                    onChange={(event) => setDistance(event.target.value)}
                    className="w-full rounded-full border border-[color:var(--border)] bg-white/[0.05] px-3 py-2.5 text-sm text-[color:var(--text-primary)] outline-none"
                  >
                    <option value="any">Any distance</option>
                    <option value="under-2">Under 2 mi</option>
                    <option value="under-5">Under 5 mi</option>
                    <option value="over-5">Over 5 mi</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="event-age" className="mb-2 block text-sm font-medium text-[color:var(--text-secondary)]">Age</label>
                  <select
                    id="event-age"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    className="w-full rounded-full border border-[color:var(--border)] bg-white/[0.05] px-3 py-2.5 text-sm text-[color:var(--text-primary)] outline-none"
                  >
                    <option value="any">Any age</option>
                    <option value="21+">21+</option>
                    <option value="18+">18+</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/[0.05] px-3 py-2 text-sm text-[color:var(--text-secondary)]">
                  <input type="checkbox" checked={openNowOnly} onChange={() => setOpenNowOnly((value) => !value)} className="h-4 w-4 rounded border-white/25 bg-transparent accent-cyan-500" />
                  Live now
                </label>
                <label className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/[0.05] px-3 py-2 text-sm text-[color:var(--text-secondary)]">
                  <input type="checkbox" checked={ticketAvailableOnly} onChange={() => setTicketAvailableOnly((value) => !value)} className="h-4 w-4 rounded border-white/25 bg-transparent accent-violet-500" />
                  Tickets available
                </label>
                <label className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/[0.05] px-3 py-2 text-sm text-[color:var(--text-secondary)]">
                  <input type="checkbox" checked={hasSpecialGuestOnly} onChange={() => setHasSpecialGuestOnly((value) => !value)} className="h-4 w-4 rounded border-white/25 bg-transparent accent-amber-500" />
                  Special guests
                </label>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[color:var(--text-secondary)]">Guest type</p>
                <div className="flex flex-wrap gap-2">
                  {["artist", "celebrity", "athlete", "influencer", "host"].map((type) => (
                    <NightlyChip
                      key={type}
                      label={type.charAt(0).toUpperCase() + type.slice(1)}
                      active={guestTypes.includes(type)}
                      onClick={() => toggleGuestType(type)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-7 nightly-surface-elevated p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <NightlySectionHeader
                eyebrow="Tonight"
                title="Matching Events"
                subtitle="Sorted and filtered from active published listings."
                className="mb-0"
              />

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "recommended", label: "Recommended" },
                  { key: "soonest", label: "Soonest" },
                  { key: "closest", label: "Closest" },
                  { key: "lowest-cover", label: "Lowest Cover" },
                ].map((option) => (
                  <NightlyChip key={option.key} label={option.label} active={sortBy === option.key} onClick={() => setSortBy(option.key as SortOption)} />
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)] sm:text-sm">
              <span>{filteredEvents.length} matching events</span>
              <span className="rounded-full border border-[color:var(--border)] bg-black/20 px-3 py-1">Live-aware ranking</span>
            </div>
          </section>

          {filteredEvents.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NightlyEmptyState
                eyebrow="No Matches"
                title="No events match this filter mix"
                description="The current combination is very narrow. Reset filters or expand your date and genre scope."
                primaryAction={{ label: "Browse Venues", href: "/discover" }}
                secondaryAction={{ label: "Reset Filters", onClick: clearFilters }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
