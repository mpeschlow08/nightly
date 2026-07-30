"use client";

import Link from "next/link";
import { useState } from "react";

import EventImage from "@/components/media/EventImage";
import type { ConsumerEventCard } from "@/lib/consumer/types";

type EventCardProps = {
  event: ConsumerEventCard;
};

export default function EventCard({ event }: EventCardProps) {
  const [saved, setSaved] = useState(false);
  const imageUrl = event.imageUrl;

  return (
    <article className="nightly-card nightly-card-interactive overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="relative">
        <EventImage src={imageUrl} alt={`${event.name} artwork`} orientation="portrait" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/18 to-transparent" />
        {event.isLive ? (
          <span className="absolute left-3 top-3 rounded-full border border-cyan-200/30 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100">
            Live
          </span>
        ) : null}
        {event.ticketStatus === "Sold out" ? (
          <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-100">
            Sold Out
          </span>
        ) : null}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">{event.dateLabel}</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{event.name}</h3>
            <p className="mt-1 text-sm text-zinc-400">{event.venueName}</p>
          </div>
          <button
            type="button"
            onClick={() => setSaved((value) => !value)}
            className={`nightly-btn-secondary rounded-full border px-2.5 py-1 text-xs font-medium ${saved ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-white/10 text-zinc-300 hover:text-white"}`}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {event.genres.map((genre) => (
            <span key={genre} className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-zinc-300">
              {genre}
            </span>
          ))}
        </div>

        <div className="grid gap-2 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">When</span>
            <span className="font-medium text-white">{event.startTimeLabel}{event.endTimeLabel ? ` • ${event.endTimeLabel}` : ""}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Where</span>
            <span className="font-medium text-white">{event.neighborhood}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Cover</span>
            <span className="font-medium text-white">${event.cover}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Vibe</span>
            <span className="font-medium text-white">{event.distanceMiles != null ? `${event.distanceMiles.toFixed(1)} mi` : "--"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
          {event.crowdLevel ? <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{event.crowdLevel}</span> : null}
          {event.ageRequirementLabel ? <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{event.ageRequirementLabel}</span> : null}
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{event.ticketStatus}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="nightly-btn-secondary rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-200 hover:text-white">
            Share
          </button>
          <Link href={`/events/${event.slug}`} className="nightly-btn-primary rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90">
            View Event
          </Link>
        </div>
      </div>
    </article>
  );
}
