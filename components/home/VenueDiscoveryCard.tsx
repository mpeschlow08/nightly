"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import VenueImage from "@/components/media/VenueImage";
import type { ConsumerVenueCard } from "@/lib/consumer/types";
import { trackDiscoveryInteraction } from "@/lib/discovery/analytics-client";

type VenueDiscoveryCardProps = {
  venue: ConsumerVenueCard;
  animationDelayMs?: number;
  className?: string;
};

const crowdToneByLevel: Record<string, string> = {
  Mellow: "bg-emerald-400/85",
  Steady: "bg-sky-400/85",
  Buzzing: "bg-cyan-300/85",
  Packed: "bg-rose-400/85",
};

export default function VenueDiscoveryCard({
  venue,
  animationDelayMs = 0,
  className,
}: VenueDiscoveryCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!venue.specialGuestHighlight) {
      return;
    }

    void fetch("/api/discovery/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "special_guest_view",
        recommendationType: "venue",
        itemId: venue.id,
        specialGuestId: venue.specialGuestHighlight.id,
        trafficSource: "discover_venue_card",
      }),
    });
  }, [venue.id, venue.specialGuestHighlight]);

  return (
    <article
      className={`nightly-card nightly-card-interactive nightly-fade-in group relative min-h-[18.8rem] min-w-[17.2rem] snap-start overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#050912] shadow-[0_20px_54px_rgba(0,0,0,0.42)] active:scale-[0.99] sm:min-w-[18.2rem] ${className ?? ""}`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="relative overflow-hidden">
        <Link
          href={venue.href}
          aria-label={`Open ${venue.name} venue details`}
          className="block"
          onClick={() => {
            void trackDiscoveryInteraction({
              event: "recommendation_click",
              recommendationType: "venue",
              itemId: venue.id,
              explanationCategory: venue.recommendationReasonCode,
            });
            if (venue.specialGuestHighlight) {
              void fetch("/api/discovery/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "special_guest_click",
                  recommendationType: "venue",
                  itemId: venue.id,
                  specialGuestId: venue.specialGuestHighlight.id,
                  trafficSource: "discover_venue_card",
                }),
              });
              void fetch("/api/discovery/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "special_guest_venue_conversion",
                  recommendationType: "venue",
                  itemId: venue.id,
                  specialGuestId: venue.specialGuestHighlight.id,
                  trafficSource: "discover_venue_card",
                }),
              });
            }
          }}
        >
          <VenueImage src={venue.thumbnailImageUrl || venue.heroImageUrl} alt={`${venue.name} nightlife scene`} orientation="portrait" className="rounded-none" />
        </Link>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {venue.isLive ? (
          <span className="absolute left-3 top-3 rounded-full border border-rose-300/40 bg-rose-500/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-rose-100">
            LIVE
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => {
            const next = !isFavorite;
            setIsFavorite(next);
            void trackDiscoveryInteraction({
              event: next ? "recommendation_save" : "recommendation_dismiss",
              recommendationType: "venue",
              itemId: venue.id,
              explanationCategory: venue.recommendationReasonCode,
            });
          }}
          aria-label={isFavorite ? `Unfavorite ${venue.name}` : `Favorite ${venue.name}`}
          className="nightly-btn-secondary absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/45 text-sm text-white backdrop-blur"
        >
          {isFavorite ? "♥" : "♡"}
        </button>

        {venue.specialGuestHighlight ? (
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-amber-300/45 bg-black/70 px-3 py-2 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <p className="line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                {venue.specialGuestHighlight.badge} · {venue.specialGuestHighlight.title}
              </p>
              {venue.specialGuestHighlight.additionalCount > 0 ? (
                <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-100">
                  +{venue.specialGuestHighlight.additionalCount} more
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-1 text-[11px] text-amber-50/90">
              {venue.specialGuestHighlight.verificationBadge ? `${venue.specialGuestHighlight.verificationBadge} · ` : ""}
              {venue.specialGuestHighlight.subtitle}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 p-3.5">
        <div>
          <h3 className="line-clamp-1 text-[1.02rem] font-semibold tracking-tight text-white">
            <Link
              href={venue.href}
              className="focus-visible:outline-none"
              onClick={() => {
                void trackDiscoveryInteraction({
                  event: "recommendation_click",
                  recommendationType: "venue",
                  itemId: venue.id,
                  explanationCategory: venue.recommendationReasonCode,
                });
                if (venue.specialGuestHighlight) {
                  void fetch("/api/discovery/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      event: "special_guest_click",
                      recommendationType: "venue",
                      itemId: venue.id,
                      specialGuestId: venue.specialGuestHighlight.id,
                      trafficSource: "discover_venue_card",
                    }),
                  });
                  void fetch("/api/discovery/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      event: "special_guest_venue_conversion",
                      recommendationType: "venue",
                      itemId: venue.id,
                      specialGuestId: venue.specialGuestHighlight.id,
                      trafficSource: "discover_venue_card",
                    }),
                  });
                }
              }}
            >
              {venue.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">{venue.neighborhood}</p>
        </div>

        <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
              {venue.genre}
            </span>
            <span className="text-xs text-zinc-300">{venue.distanceLabel ?? venue.neighborhood}</span>
        </div>

        {venue.recommendationReason ? (
          <p className="line-clamp-1 text-[11px] text-cyan-200/90">{venue.recommendationReason}</p>
        ) : null}

        {venue.crowdLevel ? (
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className={`h-2.5 w-2.5 rounded-full ${crowdToneByLevel[venue.crowdLevel] ?? "bg-zinc-400/80"}`} />
            <span>{venue.crowdLevel} crowd</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
