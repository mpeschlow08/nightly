"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import { discoverVenues, genres } from "@/data/nightly";

type CrowdFilter = "any" | "quiet" | "busy" | "packed";

type VenueWithCoords = (typeof discoverVenues)[number] & {
  coordinates: [number, number];
};

const venueCoordinates: Record<number, [number, number]> = {
  1: [33.789, -84.383],
  2: [33.759, -84.389],
  3: [33.754, -84.365],
  4: [33.789, -84.388],
  5: [33.839, -84.367],
  6: [33.787, -84.387],
  7: [33.787, -84.412],
  8: [33.838, -84.372],
  9: [33.755, -84.37],
  10: [33.785, -84.389],
  11: [33.756, -84.389],
  12: [33.781, -84.349],
};

const venuesWithCoords: VenueWithCoords[] = discoverVenues.map((venue) => ({
  ...venue,
  coordinates: venueCoordinates[venue.id] ?? [33.78, -84.39],
}));

const defaultCenter: [number, number] = [33.78, -84.39];

const MapLeaflet = dynamic(() => import("@/components/MapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[62vh] min-h-[420px] items-center justify-center rounded-[2rem] border border-white/10 bg-zinc-950/70 text-sm text-zinc-400">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  const [selectedGenre, setSelectedGenre] = useState("any");
  const [distance, setDistance] = useState("any");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [crowd, setCrowd] = useState<CrowdFilter>("any");
  const [selectedVenue, setSelectedVenue] = useState<VenueWithCoords | null>(venuesWithCoords[1]);
  const [nearMe, setNearMe] = useState(false);

  const filteredVenues = useMemo(() => {
    return venuesWithCoords.filter((venue) => {
      const matchesGenre = selectedGenre === "any" || venue.genres.includes(selectedGenre);
      const matchesDistance =
        distance === "any" ||
        (distance === "under-2" && venue.distanceMiles <= 2) ||
        (distance === "under-5" && venue.distanceMiles <= 5);
      const matchesOpenNow = !openNowOnly || venue.isOpenNow;
      const matchesCrowd =
        crowd === "any" ||
        (crowd === "quiet" && venue.crowdLevel.toLowerCase() === "mellow") ||
        (crowd === "busy" && ["buzzing", "high"].includes(venue.crowdLevel.toLowerCase())) ||
        (crowd === "packed" && venue.crowdLevel.toLowerCase() === "packed");

      return matchesGenre && matchesDistance && matchesOpenNow && matchesCrowd;
    });
  }, [crowd, distance, openNowOnly, selectedGenre]);

  const center = useMemo<[number, number]>(() => {
    if (!nearMe) {
      return defaultCenter;
    }

    return [33.781, -84.388];
  }, [nearMe]);

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />
        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Map</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Nightlife Map
                </h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Follow the energy in real time with venue pins, crowd-based colors, and a polished overlay for planning your next stop.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setNearMe((value) => !value)} className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
                  {nearMe ? "Near me on" : "Near Me"}
                </button>
                <Link href="/discover" className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                  Discover venues
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Genre</label>
                <select value={selectedGenre} onChange={(event) => setSelectedGenre(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="any">Any genre</option>
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Distance</label>
                <select value={distance} onChange={(event) => setDistance(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="any">Any distance</option>
                  <option value="under-2">Under 2 mi</option>
                  <option value="under-5">Under 5 mi</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Crowd</label>
                <select value={crowd} onChange={(event) => setCrowd(event.target.value as CrowdFilter)} className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="any">Any mood</option>
                  <option value="quiet">Quiet</option>
                  <option value="busy">Busy</option>
                  <option value="packed">Packed</option>
                </select>
              </div>

              <label className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-zinc-200">
                <input type="checkbox" checked={openNowOnly} onChange={() => setOpenNowOnly((value) => !value)} className="h-4 w-4 rounded border-white/20 accent-cyan-500" />
                Open now
              </label>
            </div>
          </section>

          <section className="mt-8">
            <MapLeaflet
              venues={filteredVenues}
              selectedVenue={selectedVenue}
              onSelectVenue={setSelectedVenue}
              center={center}
              zoom={13}
            />
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
