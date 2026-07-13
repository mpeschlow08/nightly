"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import BottomNav from "@/components/BottomNav";
import EventCard from "@/components/EventCard";
import Navbar from "@/components/Navbar";
import { genres } from "@/data/nightly";
import { nightlyEvents } from "@/data/events";

type SortOption = "recommended" | "soonest" | "closest" | "highest-vibe" | "lowest-cover";
type DateOption = "tonight" | "tomorrow" | "weekend" | "custom";

const dateOptions: { key: DateOption; label: string }[] = [
  { key: "tonight", label: "Tonight" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "This Weekend" },
  { key: "custom", label: "Custom Date" },
];

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<DateOption>("tonight");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [cover, setCover] = useState("any");
  const [distance, setDistance] = useState("any");
  const [crowd, setCrowd] = useState("any");
  const [age, setAge] = useState("any");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [ticketAvailableOnly, setTicketAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");

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
    setSortBy("recommended");
  };

  const filteredEvents = useMemo(() => {
    const matches = nightlyEvents.filter((event) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        [event.name, event.venueName, event.neighborhood, event.lineup.join(" "), event.genres.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDate =
        selectedDate === "tonight"
          ? event.dateLabel === "Tonight"
          : selectedDate === "tomorrow"
            ? event.dateLabel === "Tomorrow"
            : selectedDate === "weekend"
              ? event.dateLabel === "This Weekend"
              : true;

      const matchesGenres = selectedGenres.length === 0 || selectedGenres.every((genre) => event.genres.includes(genre));
      const matchesCover = cover === "any" || (cover === "under-20" && event.cover <= 20) || (cover === "under-30" && event.cover <= 30) || (cover === "over-30" && event.cover > 30);
      const matchesDistance = distance === "any" || (distance === "under-2" && event.distanceMiles <= 2) || (distance === "under-5" && event.distanceMiles <= 5) || (distance === "over-5" && event.distanceMiles > 5);
      const matchesCrowd = crowd === "any" || event.crowdLevel.toLowerCase() === crowd.toLowerCase();
      const matchesAge = age === "any" || event.ageRequirement === age;
      const matchesOpenNow = !openNowOnly || event.isOpenNow;
      const matchesTicket = !ticketAvailableOnly || event.ticketStatus !== "Sold out";

      return matchesQuery && matchesDate && matchesGenres && matchesCover && matchesDistance && matchesCrowd && matchesAge && matchesOpenNow && matchesTicket;
    });

    const sorted = [...matches];

    switch (sortBy) {
      case "soonest":
        sorted.sort((a, b) => a.startTime.localeCompare(b.startTime));
        break;
      case "closest":
        sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
        break;
      case "highest-vibe":
        sorted.sort((a, b) => b.vibeScore - a.vibeScore);
        break;
      case "lowest-cover":
        sorted.sort((a, b) => a.cover - b.cover);
        break;
      case "recommended":
      default:
        sorted.sort((a, b) => b.vibeScore - a.vibeScore || a.distanceMiles - b.distanceMiles);
        break;
    }

    return sorted;
  }, [age, cover, crowd, distance, openNowOnly, search, selectedDate, selectedGenres, sortBy, ticketAvailableOnly]);

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.16),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Events</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">Events Tonight</h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">Find the right room, lineup, and energy for your night.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-zinc-200">Atlanta, GA</div>
                <Link href="/discover" className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">Browse venues</Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <label htmlFor="event-search" className="text-sm font-medium text-zinc-300">Search</label>
                <input id="event-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Event, DJ, venue, or genre" className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-medium text-zinc-300">Location</p>
                <div className="mt-2 flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-zinc-200">
                  <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-200">Atlanta, GA</span>
                  <span className="text-zinc-400">Curated tonight</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {dateOptions.map((option) => (
                <button key={option.key} type="button" onClick={() => setSelectedDate(option.key)} className={`rounded-full px-3 py-2 text-sm transition ${selectedDate === option.key ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "border border-white/10 bg-white/10 text-zinc-300 hover:border-cyan-400/30 hover:text-white"}`}>
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Filters</p>
                  <p className="text-sm text-zinc-400">Narrow by mood, budget, and access.</p>
                </div>
                <button type="button" onClick={clearFilters} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/40 hover:text-white">Clear Filters</button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                <div>
                  <p className="mb-3 text-sm font-medium text-zinc-300">Genres</p>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => {
                      const active = selectedGenres.includes(genre);
                      return (
                        <button key={genre} type="button" onClick={() => toggleGenre(genre)} className={`rounded-full px-3 py-2 text-sm transition ${active ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "border border-white/10 bg-white/10 text-zinc-300 hover:border-cyan-400/30 hover:text-white"}`}>
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="event-cover" className="mb-3 block text-sm font-medium text-zinc-300">Cover price</label>
                  <select id="event-cover" value={cover} onChange={(event) => setCover(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none">
                    <option value="any">Any cover</option>
                    <option value="under-20">Under $20</option>
                    <option value="under-30">Under $30</option>
                    <option value="over-30">$30+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="event-distance" className="mb-3 block text-sm font-medium text-zinc-300">Distance</label>
                  <select id="event-distance" value={distance} onChange={(event) => setDistance(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none">
                    <option value="any">Any distance</option>
                    <option value="under-2">Under 2 mi</option>
                    <option value="under-5">Under 5 mi</option>
                    <option value="over-5">Over 5 mi</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="event-age" className="mb-3 block text-sm font-medium text-zinc-300">Age</label>
                  <select id="event-age" value={age} onChange={(event) => setAge(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none">
                    <option value="any">Any age</option>
                    <option value="21+">21+</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-200">
                  <input type="checkbox" checked={openNowOnly} onChange={() => setOpenNowOnly((value) => !value)} className="h-4 w-4 rounded border-white/25 bg-transparent accent-cyan-500" />
                  Open now
                </label>
                <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-200">
                  <input type="checkbox" checked={ticketAvailableOnly} onChange={() => setTicketAvailableOnly((value) => !value)} className="h-4 w-4 rounded border-white/25 bg-transparent accent-violet-500" />
                  Ticket available
                </label>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[1.6rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-pink-300/80">Tonight’s lineup</p>
                <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Matching events</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Every result below is locally filtered for your current mood.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "recommended", label: "Recommended" },
                  { key: "soonest", label: "Soonest" },
                  { key: "closest", label: "Closest" },
                  { key: "highest-vibe", label: "Highest Vibe" },
                  { key: "lowest-cover", label: "Lowest Cover" },
                ].map((option) => (
                  <button key={option.key} type="button" onClick={() => setSortBy(option.key as SortOption)} className={`rounded-full px-3 py-2 text-sm transition ${sortBy === option.key ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "border border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-400/30 hover:text-white"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
              <span>{filteredEvents.length} matching events</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Atlanta nightlife • live filtered</span>
            </div>
          </section>

          {filteredEvents.length > 0 ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">No matches</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Try widening your filters</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">The current mix is a little too narrow for tonight’s city pulse. Reset the controls and browse the full lineup again.</p>
              <button type="button" onClick={clearFilters} className="mt-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90">Reset Filters</button>
            </div>
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
