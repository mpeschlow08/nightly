"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import type { ConsumerVenueCard } from "@/lib/consumer/types";
import type { MapVenue } from "@/components/MapLeaflet";
import NightlyButton from "@/components/nightly/NightlyButton";

type CrowdFilter = "any" | "quiet" | "busy" | "packed";

type MapPageClientProps = {
  venues: ConsumerVenueCard[];
};

const defaultCenter: [number, number] = [33.78, -84.39];

const MapLeaflet = dynamic(() => import("@/components/MapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[62vh] min-h-[420px] items-center justify-center rounded-[2rem] border border-white/10 bg-zinc-950/70 text-sm text-zinc-400">
      Loading map...
    </div>
  ),
});

function deriveCoordinates(venue: ConsumerVenueCard): [number, number] {
  const byIdFallback: Record<number, [number, number]> = {
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

  return byIdFallback[venue.id] ?? defaultCenter;
}

export default function MapPageClient({ venues }: MapPageClientProps) {
  const [selectedGenre, setSelectedGenre] = useState("any");
  const [distance, setDistance] = useState("any");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [crowd, setCrowd] = useState<CrowdFilter>("any");
  const [nearMe, setNearMe] = useState(false);

  const venuesWithCoords = useMemo<MapVenue[]>(
    () =>
      venues.map((venue) => ({
        ...venue,
        coordinates: deriveCoordinates(venue),
      })),
    [venues]
  );

  const [selectedVenue, setSelectedVenue] = useState<MapVenue | null>(venuesWithCoords[0] ?? null);

  const genreOptions = useMemo(
    () => Array.from(new Set(venues.flatMap((venue) => venue.genres))).sort((a, b) => a.localeCompare(b)),
    [venues]
  );

  const filteredVenues = useMemo(() => {
    return venuesWithCoords.filter((venue) => {
      const matchesGenre = selectedGenre === "any" || venue.genres.includes(selectedGenre);
      const miles = Number.parseFloat(venue.distanceLabel?.replace(/[^\d.]/g, "") ?? "999");
      const matchesDistance =
        distance === "any" ||
        (distance === "under-2" && miles <= 2) ||
        (distance === "under-5" && miles <= 5);
      const matchesOpenNow = !openNowOnly || venue.liveLabel === "OPEN NOW" || venue.isLive;
      const matchesCrowd =
        crowd === "any" ||
        (crowd === "quiet" && (venue.crowdLevel ?? "").toLowerCase() === "mellow") ||
        (crowd === "busy" && ["buzzing", "high", "steady"].includes((venue.crowdLevel ?? "").toLowerCase())) ||
        (crowd === "packed" && (venue.crowdLevel ?? "").toLowerCase() === "packed");

      return matchesGenre && matchesDistance && matchesOpenNow && matchesCrowd;
    });
  }, [crowd, distance, openNowOnly, selectedGenre, venuesWithCoords]);

  const center = useMemo<[number, number]>(() => {
    if (!nearMe) {
      return defaultCenter;
    }

    return [33.781, -84.388];
  }, [nearMe]);

  return (
    <div className="nightly-page min-h-screen text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="nightly-surface-elevated p-5 sm:p-7 lg:p-9">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="nightly-eyebrow">Explore the city</p>
                <h1 className="nightly-page-title nightly-accent-heading mt-3 sm:text-4xl">
                  Nightlife Map
                </h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Explore synced venue records with map pins and direct links to venue detail pages.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setNearMe((value) => !value)} className="nightly-btn-primary min-h-11 rounded-full border border-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sky-400 px-4 py-2.5 text-sm font-medium text-white">
                  {nearMe ? "Near me on" : "Near Me"}
                </button>
                <NightlyButton href="/discover" variant="secondary">Discover venues</NightlyButton>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Genre</label>
                <select value={selectedGenre} onChange={(event) => setSelectedGenre(event.target.value)} className="nightly-control w-full outline-none">
                  <option value="any">Any genre</option>
                  {genreOptions.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Distance</label>
                <select value={distance} onChange={(event) => setDistance(event.target.value)} className="nightly-control w-full outline-none">
                  <option value="any">Any distance</option>
                  <option value="under-2">Under 2 mi</option>
                  <option value="under-5">Under 5 mi</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Crowd</label>
                <select value={crowd} onChange={(event) => setCrowd(event.target.value as CrowdFilter)} className="nightly-control w-full outline-none">
                  <option value="any">Any mood</option>
                  <option value="quiet">Quiet</option>
                  <option value="busy">Busy</option>
                  <option value="packed">Packed</option>
                </select>
              </div>

              <label className="nightly-control flex items-center justify-center gap-2 text-sm">
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
      </div>
    </div>
  );
}
