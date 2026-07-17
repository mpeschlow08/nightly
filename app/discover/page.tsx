"use client";

import Link from "next/link";
import { useEffect, useMemo,useState } from "react";


import BottomNav from "@/components/BottomNav";
import DiscoverVenueCard from "@/components/DiscoverVenueCard";
import Navbar from "@/components/Navbar";
import { genres } from "@/data/nightly";

type SortOption = "recommended" | "closest" | "highest-vibe" | "lowest-cover";

export default function DiscoverPage() {
  const [discoverVenues, setDiscoverVenues] = useState<any[]>([]);

useEffect(() => {
  fetch("/api/venues")
    .then((res) => res.json())
    .then((data) => setDiscoverVenues(data));
}, []);
  const [search, setSearch] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [distance, setDistance] = useState("any");
  const [crowd, setCrowd] = useState("any");
  const [cover, setCover] = useState("any");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedGenres([]);
    setDistance("any");
    setCrowd("any");
    setCover("any");
    setOpenNowOnly(false);
    setLiveOnly(false);
    setSortBy("recommended");
  };

  const filteredVenues = useMemo(() => {
    const matches = discoverVenues.filter((venue) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        [venue.name, venue.neighborhood, venue.tagline, venue.genres.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesGenres =
        selectedGenres.length === 0 || selectedGenres.every((genre) => venue.genres.includes(genre));

      const matchesDistance =
        distance === "any" ||
        (distance === "under-2" && venue.distanceMiles <= 2) ||
        (distance === "under-5" && venue.distanceMiles <= 5) ||
        (distance === "over-5" && venue.distanceMiles > 5);

      const matchesCrowd = crowd === "any" || venue.crowdLevel.toLowerCase() === crowd.toLowerCase();

      const matchesCover =
        cover === "any" ||
        (cover === "under-20" && venue.cover <= 20) ||
        (cover === "under-30" && venue.cover <= 30) ||
        (cover === "over-30" && venue.cover > 30);

      const matchesOpenNow = !openNowOnly || venue.isOpenNow;
      const matchesLive = !liveOnly || venue.livePreviewAvailable;

      return (
        matchesQuery &&
        matchesGenres &&
        matchesDistance &&
        matchesCrowd &&
        matchesCover &&
        matchesOpenNow &&
        matchesLive
      );
    });

    const sorted = [...matches];

    switch (sortBy) {
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
}, [
  cover,
  crowd,
  discoverVenues,
  distance,
  liveOnly,
  openNowOnly,
  search,
  selectedGenres,
  sortBy,
]);
  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Discover</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Discover Tonight
                </h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Find venues and events matching your mood, music, and location around Atlanta.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/" className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                  Back home
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <label htmlFor="location" className="text-sm font-medium text-zinc-300">
                  Location
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-zinc-200">
                  <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                    Atlanta, GA
                  </span>
                  <span className="text-zinc-400">Curated for tonight</span>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                <label htmlFor="venue-search" className="text-sm font-medium text-zinc-300">
                  Search
                </label>
                <input
                  id="venue-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Venue, DJ, event, or genre"
                  className="mt-2 w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Filters</p>
                  <p className="text-sm text-zinc-400">Narrow the room by mood and budget.</p>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/40 hover:text-white"
                >
                  Clear Filters
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                <div>
                  <p className="mb-3 text-sm font-medium text-zinc-300">Music genres</p>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => {
                      const active = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`rounded-full px-3 py-2 text-sm transition ${
                            active
                              ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
                              : "border border-white/10 bg-white/10 text-zinc-300 hover:border-cyan-400/30 hover:text-white"
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="distance" className="mb-3 block text-sm font-medium text-zinc-300">
                    Distance
                  </label>
                  <select
                    id="distance"
                    value={distance}
                    onChange={(event) => setDistance(event.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="any">Any distance</option>
                    <option value="under-2">Under 2 mi</option>
                    <option value="under-5">Under 5 mi</option>
                    <option value="over-5">Over 5 mi</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="crowd" className="mb-3 block text-sm font-medium text-zinc-300">
                    Crowd level
                  </label>
                  <select
                    id="crowd"
                    value={crowd}
                    onChange={(event) => setCrowd(event.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="any">Any mood</option>
                    <option value="mellow">Mellow</option>
                    <option value="buzzing">Buzzing</option>
                    <option value="packed">Packed</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cover" className="mb-3 block text-sm font-medium text-zinc-300">
                    Cover price
                  </label>
                  <select
                    id="cover"
                    value={cover}
                    onChange={(event) => setCover(event.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="any">Any cover</option>
                    <option value="under-20">Under $20</option>
                    <option value="under-30">Under $30</option>
                    <option value="over-30">$30+</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={openNowOnly}
                    onChange={() => setOpenNowOnly((value) => !value)}
                    className="h-4 w-4 rounded border-white/25 bg-transparent accent-cyan-500"
                  />
                  Open now
                </label>

                <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={liveOnly}
                    onChange={() => setLiveOnly((value) => !value)}
                    className="h-4 w-4 rounded border-white/25 bg-transparent accent-violet-500"
                  />
                  Live preview available
                </label>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[1.6rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-pink-300/80">Tonight</p>
                <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Trending Venues Tonight</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  A curated list of Atlanta rooms with the strongest energy, the best live sets, and the lowest friction for tonight.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "recommended", label: "Recommended" },
                  { key: "closest", label: "Closest" },
                  { key: "highest-vibe", label: "Highest Vibe" },
                  { key: "lowest-cover", label: "Lowest Cover" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSortBy(option.key as SortOption)}
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      sortBy === option.key
                        ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
                        : "border border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-400/30 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
             <span>{filteredVenues.length} venues matching your mood</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Atlanta nightlife • live tonight</span>
            </div>
          </section>

          {filteredVenues.length > 0 ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {filteredVenues.map((venue) => (
                <DiscoverVenueCard
                  key={venue.id}
                  venue={venue}
                  isSaved={savedIds.includes(venue.id)}
                  onToggleSave={() =>
                    setSavedIds((current) =>
                      current.includes(venue.id)
                        ? current.filter((id) => id !== venue.id)
                        : [...current, venue.id],
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <p className="text-2xl font-semibold text-white">No venues matched that combo yet.</p>
              <p className="mt-3 text-base leading-7 text-zinc-400">
                Try widening the filters or resetting them to bring the city’s best rooms back into view.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Reset Filters
              </button>
            </div>
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
