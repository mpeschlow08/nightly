import Link from "next/link";

import EventImage from "@/components/media/EventImage";
import type { ConsumerEventCard } from "@/lib/consumer/types";

type Props = {
  event: ConsumerEventCard;
};

export default function LiveEventCard({ event }: Props) {
  return (
    <article className="nightly-card nightly-card-interactive min-w-[16.5rem] snap-start overflow-hidden rounded-[1.15rem] border border-white/10 bg-[#070a14]">
      <div className="relative">
        <EventImage src={event.imageUrl} alt={`${event.name} artwork`} orientation="portrait" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      </div>
      <div className="space-y-2 p-3.5">
        <p className="line-clamp-1 text-sm font-semibold text-white">{event.name}</p>
        <p className="line-clamp-1 text-xs text-zinc-300">{event.venueName}</p>
        <p className="text-xs text-zinc-400">{event.startTimeLabel}</p>
        <Link
          href={event.href}
          className="nightly-btn-secondary mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/20 bg-black/25 px-3 text-xs font-semibold text-zinc-100"
        >
          View Event
        </Link>
      </div>
    </article>
  );
}
