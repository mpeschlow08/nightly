import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import EventImage from "@/components/media/EventImage";
import VenueImage from "@/components/media/VenueImage";

export type HomePhotoItem = {
  id: string;
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
  const imageClassName = "!absolute !inset-0 !h-full !w-full !aspect-auto !rounded-none transition-transform duration-500 group-hover:scale-[1.025]";

  return (
    <Link
      href={item.href}
      aria-label={`Open ${item.name}${item.kind === "event" ? " event" : " venue"}`}
      className={`group relative block w-full overflow-hidden rounded-[15px] border border-white/10 bg-[#100d18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 ${className}`}
    >
      {item.kind === "venue" ? (
        <VenueImage src={item.imageUrl} alt={item.imageAlt} orientation="horizontal" className={imageClassName} priority={priority} />
      ) : (
        <EventImage src={item.imageUrl} alt={item.imageAlt} orientation="horizontal" className={imageClassName} priority={priority} />
      )}
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />

      <span className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-3">
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {item.statusLabel ? (
            <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[10px] font-semibold leading-none ${item.statusTone === "live" ? "border-rose-300/45 bg-rose-500/20 text-rose-50" : "border-violet-200/30 bg-[#100b1b]/80 text-violet-50"}`}>
              {item.statusLabel}
            </span>
          ) : null}
          {item.crowdLabel ? (
            <span className="inline-flex min-h-6 items-center rounded-md border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-medium leading-none text-white/90">
              {item.crowdLabel}
            </span>
          ) : null}
        </span>
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-sm" aria-hidden="true">
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </span>
      </span>

      <span className="absolute inset-x-0 bottom-0 block p-3 sm:p-3.5">
        {item.specialGuestTitle ? <span className="mb-1 block truncate text-[10px] font-medium text-amber-100">Special Guest · {item.specialGuestTitle}</span> : null}
        <span className="block line-clamp-1 text-[15px] font-semibold leading-tight text-white sm:text-base">{item.name}</span>
        <span className="mt-1 block line-clamp-1 text-[11px] leading-tight text-white/75 sm:text-xs">{item.detail}</span>
      </span>
    </Link>
  );
}