"use client";

import { useEffect, useMemo, useState } from "react";

import ComingSoonFeatureCard from "@/components/live/ComingSoonFeatureCard";
import ComingSoonModal from "@/components/live/ComingSoonModal";
import LiveActivityItem from "@/components/live/LiveActivityItem";
import LiveDjCard from "@/components/live/LiveDjCard";
import LiveEventCard from "@/components/live/LiveEventCard";
import LivePreviewCard from "@/components/live/LivePreviewCard";
import LiveSectionHeader from "@/components/live/LiveSectionHeader";
import LiveVenueCard from "@/components/live/LiveVenueCard";
import {
  comingSoonFeatures,
} from "@/data/nightly-live";
import type { LiveDataPayload } from "@/lib/consumer/types";

type NightlyLiveClientProps = {
  data: LiveDataPayload;
};

export default function NightlyLiveClient({ data }: NightlyLiveClientProps) {
  const [activeTrendIndex, setActiveTrendIndex] = useState(0);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);

  const trendingNowChips = useMemo(() => {
    const genres = new Set<string>();

    for (const event of data.events) {
      for (const genre of event.genres) {
        genres.add(genre);
      }
    }

    const chips = [
      ...Array.from(genres).slice(0, 5),
      ...data.venues.slice(0, 5).map((venue) => venue.neighborhood),
    ];

    return chips.filter((chip, index) => chips.indexOf(chip) === index).slice(0, 8);
  }, [data.events, data.venues]);

  const recentlyStartedItems = useMemo(
    () =>
      data.events.slice(0, 6).map((event) => ({
        id: event.id,
        title: event.name,
        venue: event.venueName,
        startedAt: event.startTimeLabel,
      })),
    [data.events]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTrendIndex((current) => (current + 1) % Math.max(trendingNowChips.length, 1));
    }, 2200);

    return () => window.clearInterval(timer);
  }, [trendingNowChips.length]);

  const selectedFeature = useMemo(
    () => comingSoonFeatures.find((feature) => feature.id === selectedFeatureId) ?? null,
    [selectedFeatureId],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_8%_0%,rgba(236,72,153,0.22),transparent_35%),radial-gradient(circle_at_95%_14%,rgba(139,92,246,0.24),transparent_32%),radial-gradient(circle_at_60%_90%,rgba(88,28,135,0.24),transparent_40%)]" />

      <main className="relative z-10 mx-auto max-w-3xl pb-24">
        <section className="sticky top-0 z-30 border-b border-white/10 bg-[#050916]/88 px-4 py-3 backdrop-blur-xl sm:px-5 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-200/80">Nightly Live</p>
              <h1 className="text-lg font-semibold tracking-tight text-white">Live Right Now</h1>
            </div>
            <span className="rounded-full border border-rose-300/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100">LIVE</span>
          </div>
        </section>

        <div className="space-y-7 px-4 pt-4 sm:px-5 lg:px-6">
          <section className="nightly-card nightly-fade-in rounded-[1.35rem] border border-white/12 bg-white/[0.04] p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/80">AI Tonight Summary</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-200">{data.summary}</p>
          </section>

          <section className="space-y-3">
            <LiveSectionHeader title="Featured Live Venues" subtitle="Where the city is moving right now." />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {data.venues.map((venue) => (
                <LiveVenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <LiveSectionHeader title="Live Now Carousel" subtitle="Preview-ready camera surfaces for launch." />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {data.venues.map((venue) => (
                <LivePreviewCard key={`preview-${venue.id}`} venue={venue} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <LiveSectionHeader title="Trending Right Now" subtitle="Signals updating throughout the night." />
            <div className="flex flex-wrap gap-2">
              {trendingNowChips.map((chip, index) => {
                const active = index === activeTrendIndex;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setActiveTrendIndex(index)}
                    className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold transition ${
                      active
                        ? "border-fuchsia-300/45 bg-fuchsia-500/18 text-fuchsia-100"
                        : "border-white/15 bg-white/[0.04] text-zinc-200 hover:border-fuchsia-300/32"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <LiveSectionHeader title="Live Events" subtitle="Events currently happening near you." />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {data.events.map((event) => (
                <LiveEventCard key={event.id} event={event} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <LiveSectionHeader title="Featured DJs Live" subtitle="DJs performing right now." />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {data.djs.map((dj) => (
                <LiveDjCard key={dj.id} dj={dj} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <LiveSectionHeader title="Recently Started" subtitle="Fresh movement from the city feed." />
            <div className="space-y-2">
              {data.activity.map((item) => (
                <LiveActivityItem key={item.id} item={item} />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {recentlyStartedItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">{item.startedAt}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-300">{item.venue}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3 pb-6">
            <LiveSectionHeader title="Coming Soon" subtitle="Preview next-gen live capabilities." />
            <div className="grid gap-2 sm:grid-cols-2">
              {comingSoonFeatures.map((feature) => (
                <ComingSoonFeatureCard
                  key={feature.id}
                  feature={feature}
                  onClick={() => setSelectedFeatureId(feature.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <ComingSoonModal
        open={Boolean(selectedFeature)}
        title={selectedFeature?.title ?? ""}
        summary={selectedFeature?.summary ?? ""}
        onClose={() => setSelectedFeatureId(null)}
      />
    </div>
  );
}
