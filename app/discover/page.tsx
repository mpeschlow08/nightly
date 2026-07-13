import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import DiscoverVenueCard from "@/components/DiscoverVenueCard";
import { discoverVenues } from "@/data/nightly";

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <div className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Discover</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Find your next favorite room.
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-300">
                Browse elevated venues across Atlanta with real-time energy, crowd cues, and the perfect late-night fit for your mood.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                Back home
              </Link>
              <button className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
                Filter by vibe
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {discoverVenues.map((venue) => (
              <DiscoverVenueCard key={venue.id} venue={venue} />
            ))}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
