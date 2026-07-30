import Link from "next/link";

import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import type { ConsumerEventCard } from "@/lib/consumer/types";

type Props = {
  tonightEvents: ConsumerEventCard[];
};

export default function EventsTonightSection({ tonightEvents }: Props) {

  return (
    <section id="events-tonight" className="mx-auto mt-7 max-w-3xl px-4 sm:px-5 lg:px-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Events Tonight</h2>
        <Link
          href="/events"
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-300"
        >
          See All
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none]">
        {tonightEvents.map((event, index) => (
          <EventDiscoveryCard
            key={event.id}
            href={event.href}
            name={event.name}
            venueName={event.venueName}
            neighborhood={event.neighborhood}
            startTime={event.startTimeLabel}
            cover={event.cover}
            imageUrl={event.imageUrl}
            ticketStatus={event.ticketStatus}
            isLive={event.isLive}
            animationDelayMs={index * 45}
          />
        ))}
      </div>
    </section>
  );
}
