"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useState } from "react";

import EventImage from "@/components/media/EventImage";
import VenueImage from "@/components/media/VenueImage";
import { trackDiscoveryInteraction } from "@/lib/discovery/analytics-client";

export type HomePhotoItem = {
  id: string;
  analyticsId?: number;
  kind: "venue" | "event";
  href: string;
  name: string;
  imageUrl: string;
  imageAlt: string;
  detail: string;
  statusLabel: string | null;
  statusTone: "live" | "violet" | null;
  crowdLabel?: string | null;
  specialGuestTitle?: string | null;
};

type HomePhotoCardProps = {
  item: HomePhotoItem;
  className?: string;
  priority?: boolean;
};

export default function HomePhotoCard({ item, className = "", priority = false }: HomePhotoCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const imageClassName = "!absolute !inset-0 !h-full !w-full !aspect-auto !rounded-none object-center transition-transform duration-500 group-hover:scale-[1.025]";
  const crowdDot = item.crowdLabel === "Packed" ? "bg-rose-300" : item.crowdLabel === "Buzzing" ? "bg-pink-300" : item.crowdLabel === "Steady" ? "bg-violet-200" : "bg-emerald-200";

  return (
    <article className={`group relative w-full overflow-hidden rounded-[8px] border border-white/[0.045] bg-[#100d18] ${className}`}>
      <Link
        href={item.href}
        aria-label={`Open ${item.name}${item.kind === "event" ? " event" : " venue"}`}
        className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
      >
        {item.kind === "venue" ? (
          <VenueImage src={item.imageUrl} alt={item.imageAlt} orientation="horizontal" className={imageClassName} priority={priority} />
        ) : (
          <EventImage src={item.imageUrl} alt={item.imageAlt} orientation="horizontal" className={imageClassName} priority={priority} />
        )}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />

        <span className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-2.5">
          <span className="flex min-w-0 flex-wrap gap-1">
            {item.statusLabel ? (
              <span className={`inline-flex min-h-5 items-center rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold leading-none tracking-[0.02em] ${item.statusTone === "live" ? "bg-rose-500/90 text-white" : "border border-violet-200/35 bg-[#100b1b]/80 text-violet-50"}`}>
                {item.statusLabel}
              </span>
            ) : null}
          </span>
        </span>

          <span className={`absolute inset-x-0 bottom-0 block p-2.5 ${item.kind === "venue" ? "pr-9" : ""}`}>
            {item.specialGuestTitle ? <span className="mb-0.5 block truncate text-[8px] font-medium text-amber-100">Special Guest · {item.specialGuestTitle}</span> : null}
            <span className="block line-clamp-1 text-[12px] font-semibold leading-[1.12] text-white">{item.name}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] leading-tight text-white/75">
              <span className="min-w-0 truncate">{item.detail}</span>
              {item.crowdLabel ? <span className="inline-flex shrink-0 items-center gap-1"><span className={`h-1 w-1 rounded-full ${crowdDot}`} aria-hidden="true" />{item.crowdLabel}</span> : null}
            </span>
        </span>
      </Link>
      {item.kind === "venue" ? (
        <button
          type="button"
          aria-label={isSaved ? `Remove ${item.name} from saved picks` : `Save ${item.name}`}
          aria-pressed={isSaved}
          title={isSaved ? "Remove saved venue" : "Save venue"}
          onClick={() => {
            const next = !isSaved;
            setIsSaved(next);
            void trackDiscoveryInteraction({
              event: next ? "recommendation_save" : "recommendation_dismiss",
              recommendationType: "venue",
              itemId: item.analyticsId ?? item.id,
            });
          }}
          className="absolute bottom-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-white/80 transition hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80"
        >
          <Bookmark size={13} strokeWidth={1.6} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}