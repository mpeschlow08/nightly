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
  variant?: "default" | "compact";
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
  variant = "default",
  animationDelayMs = 0,
  className,
}: VenueDiscoveryCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const isTrulyLive = venue.liveLabel === "EVENT LIVE" || venue.liveLabel === "CAMERA LIVE";
  const activityLabel = venue.liveLabel === "OPEN NOW" ? "Open now" : venue.liveLabel === "TRENDING" ? "Trending" : "Tonight";

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

  if (variant === "compact") {
    return (
      <article className={`nightly-fade-in group relative h-44 w-[72vw] max-w-[17rem] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#100d18] transition hover:border-violet-300/40 ${className ?? ""}`} style={{ animationDelay: `${animationDelayMs}ms` }}>
        <Link
          href={venue.href}
          aria-label={`Open ${venue.name} venue details`}
          className="absolute inset-0"
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
          <VenueImage src={venue.thumbnailImageUrl || venue.heroImageUrl} alt={`${venue.name} nightlife scene`} orientation="portrait" className="!absolute !inset-0 !h-full !w-full !aspect-auto !rounded-none" />
          <div className="nightly-image-overlay pointer-events-none absolute inset-0" />
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            {isTrulyLive ? <NightlyLiveBadge label="Live" /> : <span className="rounded-full border border-violet-200/25 bg-black/55 px-2 py-1 text-[0.58rem] font-semibold uppercase text-violet-100">{activityLabel}</span>}
            {venue.specialGuestHighlight ? <span className="rounded-full border border-amber-200/30 bg-black/55 px-2 py-1 text-[0.58rem] font-medium text-amber-100">Special Guest</span> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="line-clamp-1 text-sm font-semibold text-white">{venue.name}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-white/75">{venue.neighborhood} · {venue.genre}</p>
          </div>
        </Link>
      </article>
    );
  }

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
