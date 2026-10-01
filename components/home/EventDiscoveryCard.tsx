"use client";

import Link from "next/link";
import { useEffect } from "react";

import EventImage from "@/components/media/EventImage";
import NightlyLiveBadge from "@/components/nightly/NightlyLiveBadge";
import NightlySpecialGuestBadge from "@/components/nightly/NightlySpecialGuestBadge";
import { trackDiscoveryInteraction } from "@/lib/discovery/analytics-client";

type EventDiscoveryCardProps = {
  href: string;
  name: string;
  venueName: string;
  neighborhood: string;
  startTime: string;
  cover?: number;
  ticketStatus?: string;
  imageUrl: string;
  isLive: boolean;
  specialGuestHighlight?: {
    id: number;
    title: string;
    subtitle: string;
    badge: string;
    additionalCount: number;
  } | null;
  reason?: string;
  animationDelayMs?: number;
  className?: string;
  variant?: "default" | "compact";
};

export default function EventDiscoveryCard({
  href,
  name,
  venueName,
  neighborhood,
  startTime,
  cover,
  ticketStatus,
  imageUrl,
  isLive,
  specialGuestHighlight,
  reason,
  animationDelayMs = 0,
  className,
  variant = "default",
}: EventDiscoveryCardProps) {
  useEffect(() => {
    if (!specialGuestHighlight) {
      return;
    }

    void fetch("/api/discovery/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "special_guest_view",
        recommendationType: "event",
        itemId: href,
        specialGuestId: specialGuestHighlight.id,
        trafficSource: "discover_event_card",
      }),
    });
  }, [href, specialGuestHighlight]);

  if (variant === "compact") {
    return (
      <article className={`nightly-fade-in group relative h-44 w-[72vw] max-w-[17rem] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#100d18] transition hover:border-violet-300/40 ${className ?? ""}`} style={{ animationDelay: `${animationDelayMs}ms` }}>
        <Link
          href={href}
          aria-label={`Open ${name} event details`}
          className="absolute inset-0"
          onClick={() => {
            void trackDiscoveryInteraction({ event: "recommendation_click", recommendationType: "event", itemId: href });
            if (specialGuestHighlight) {
              void fetch("/api/discovery/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: "special_guest_click", recommendationType: "event", itemId: href, specialGuestId: specialGuestHighlight.id, trafficSource: "discover_event_card" }),
              });
            }
          }}
        >
          <EventImage src={imageUrl} alt={`${name} event cover`} orientation="portrait" className="!absolute !inset-0 !h-full !w-full !aspect-auto !rounded-none" />
          <div className="nightly-image-overlay pointer-events-none absolute inset-0" />
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            {isLive ? <NightlyLiveBadge label="Live" /> : <span className="rounded-full border border-violet-200/25 bg-black/55 px-2 py-1 text-[0.58rem] font-semibold uppercase text-violet-100">Tonight</span>}
            {specialGuestHighlight ? <span className="rounded-full border border-amber-200/30 bg-black/55 px-2 py-1 text-[0.58rem] font-medium text-amber-100">Special Guest</span> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="line-clamp-1 text-sm font-semibold text-white">{name}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-white/75">{venueName} · {startTime}</p>
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
        <EventImage src={imageUrl} alt={`${name} event cover`} orientation="portrait" className="rounded-none" />
        <div className="nightly-image-overlay absolute inset-0" />

        {isLive ? (
          <div className="absolute left-3 top-3">
            <NightlyLiveBadge />
          </div>
        ) : null}
        {specialGuestHighlight ? (
          <div className="absolute inset-x-3 bottom-3">
            <NightlySpecialGuestBadge
              badge={specialGuestHighlight.badge}
              title={specialGuestHighlight.title}
              subtitle={specialGuestHighlight.subtitle}
              additionalCount={specialGuestHighlight.additionalCount}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 p-4">
        <h3 className="line-clamp-1 text-[1.08rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
          <Link
            href={href}
            onClick={() => {
              void trackDiscoveryInteraction({
                event: "recommendation_click",
                recommendationType: "event",
                itemId: href,
              });
              if (specialGuestHighlight) {
                void fetch("/api/discovery/track", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    event: "special_guest_click",
                    recommendationType: "event",
                    itemId: href,
                    specialGuestId: specialGuestHighlight.id,
                    trafficSource: "discover_event_card",
                  }),
                });
              }
            }}
          >
            {name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-sm text-[color:var(--text-secondary)]">{venueName} • {neighborhood}</p>
        <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--text-secondary)]">
          <span className="rounded-full border border-[color:var(--border)] bg-white/5 px-2 py-0.5">{startTime}</span>
          <span>{ticketStatus ?? (typeof cover === "number" ? `$${cover}` : "Tickets")}</span>
        </div>
        {reason ? <p className="line-clamp-1 text-[0.74rem] text-sky-200/90">{reason}</p> : null}
      </div>
    </article>
  );
}
