"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import NightlyIconButton from "@/components/nightly/NightlyIconButton";
import NightlyLiveBadge from "@/components/nightly/NightlyLiveBadge";
import NightlySpecialGuestBadge from "@/components/nightly/NightlySpecialGuestBadge";
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

  const trackSpecialGuestClick = () => {
    if (!venue.specialGuestHighlight) {
      return;
    }

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
  };

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
      className={`nightly-card nightly-card-interactive nightly-fade-in group relative min-h-[19.2rem] min-w-[17.8rem] snap-start overflow-hidden rounded-[1.25rem] active:scale-[0.99] sm:min-w-[18.8rem] ${className ?? ""}`}
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
            trackSpecialGuestClick();
          }}
        >
          <VenueImage src={venue.thumbnailImageUrl || venue.heroImageUrl} alt={`${venue.name} nightlife scene`} orientation="portrait" className="rounded-none" />
        </Link>
        <div className="nightly-image-overlay pointer-events-none absolute inset-0" />

        {venue.isLive ? (
          <div className="absolute left-3 top-3">
            <NightlyLiveBadge label={venue.liveLabel ?? "Live"} />
          </div>
        ) : null}

        <NightlyIconButton
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
          label={isFavorite ? `Unfavorite ${venue.name}` : `Favorite ${venue.name}`}
          icon={<span aria-hidden="true">{isFavorite ? "♥" : "♡"}</span>}
          className="absolute right-3 top-3"
        />

        {venue.specialGuestHighlight ? (
          <div className="absolute inset-x-3 bottom-3">
            <NightlySpecialGuestBadge
              badge={venue.specialGuestHighlight.badge}
              title={venue.specialGuestHighlight.title}
              subtitle={venue.specialGuestHighlight.subtitle}
              verificationBadge={venue.specialGuestHighlight.verificationBadge}
              additionalCount={venue.specialGuestHighlight.additionalCount}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 p-4">
        <div>
          <h3 className="line-clamp-1 text-[1.13rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
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
                trackSpecialGuestClick();
              }}
            >
              {venue.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--text-secondary)]">{venue.neighborhood}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-[color:var(--border)] bg-white/5 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">
              {venue.genre}
            </span>
            <span className="text-xs text-[color:var(--text-secondary)]">{venue.distanceLabel ?? venue.neighborhood}</span>
        </div>

        {venue.recommendationReason ? (
          <p className="line-clamp-1 text-[0.74rem] text-sky-200/90">{venue.recommendationReason}</p>
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
