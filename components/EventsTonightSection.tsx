import Link from "next/link";

import EventCard from "@/components/EventCard";
import { nightlyEvents } from "@/data/events";

export default function EventsTonightSection() {
  const tonightEvents = nightlyEvents
    .filter((event) => event.dateLabel === "Tonight")
    .slice(0, 4);

  return (
    <section id="events-tonight" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Tonight</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Events Tonight</h2>
        </div>
        <Link
          href="/events"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/50 hover:text-white"
        >
          View all events
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tonightEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
