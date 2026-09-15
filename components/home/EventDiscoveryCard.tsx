"use client";

import Link from "next/link";
import { useEffect } from "react";

import EventImage from "@/components/media/EventImage";
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
      className={`nightly-card nightly-card-interactive nightly-fade-in group relative min-h-[18.8rem] min-w-[17.2rem] snap-start overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#050912] shadow-[0_20px_54px_rgba(0,0,0,0.42)] active:scale-[0.99] sm:min-w-[18.2rem] ${className ?? ""}`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="relative overflow-hidden">
        <EventImage src={imageUrl} alt={`${name} event cover`} orientation="portrait" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {isLive ? (
          <span className="absolute left-3 top-3 rounded-full border border-cyan-300/45 bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-cyan-100">
            LIVE
          </span>
        ) : null}
        {specialGuestHighlight ? (
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-amber-300/45 bg-black/70 px-3 py-2 text-amber-50 backdrop-blur">
            <p className="line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
              {specialGuestHighlight.badge} · {specialGuestHighlight.title}
            </p>
            <p className="mt-1 line-clamp-1 text-[11px]">
              {specialGuestHighlight.subtitle}
              {specialGuestHighlight.additionalCount > 0 ? ` · +${specialGuestHighlight.additionalCount} more` : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 p-3.5">
        <h3 className="line-clamp-1 text-[1.02rem] font-semibold tracking-tight text-white">
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
        <p className="line-clamp-1 text-xs text-zinc-400">{venueName} • {neighborhood}</p>
        <div className="flex items-center justify-between text-xs text-zinc-300">
          <span>{startTime}</span>
          <span>{ticketStatus ?? (typeof cover === "number" ? `$${cover}` : "Tickets")}</span>
        </div>
        {reason ? <p className="line-clamp-1 text-[11px] text-cyan-200/90">{reason}</p> : null}
      </div>
    </article>
  );
}
