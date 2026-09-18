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
