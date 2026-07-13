import Link from "next/link";
import { notFound } from "next/navigation";

import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import { getEventBySlug, getRelatedEvents } from "@/data/events";

export function generateStaticParams() {
  return [{ slug: "midnight-mirage" }, { slug: "apex-night" }, { slug: "velvet-royale" }, { slug: "afterglow-sessions" }, { slug: "moonlight-rhythm" }, { slug: "latin-after-hours" }, { slug: "midnight-bloom" }, { slug: "neon-orbit" }, { slug: "slow-burn" }, { slug: "resident-pulse" }, { slug: "backstage-country" }, { slug: "nova-hour" }];
}

type EventDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const relatedEvents = getRelatedEvents(event);

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.16),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className={`overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${event.imageClass} shadow-[0_30px_90px_rgba(0,0,0,0.34)]`}>
            <div className="bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_55%)] p-6 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/80">{event.dateLabel}</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{event.name}</h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-200">{event.description}</p>
                </div>
                <div className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm text-zinc-100 backdrop-blur">
                  {event.ticketStatus}
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/25 p-4 backdrop-blur">
                  <p className="text-sm text-zinc-300">Venue</p>
                  <p className="mt-2 text-lg font-semibold text-white">{event.venueName}</p>
                  <p className="mt-1 text-sm text-zinc-400">{event.neighborhood} • {event.venueMapLabel}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/25 p-4 backdrop-blur">
                  <p className="text-sm text-zinc-300">Schedule</p>
                  <p className="mt-2 text-lg font-semibold text-white">{event.startTime}</p>
                  <p className="mt-1 text-sm text-zinc-400">Doors {event.doorTime} • Ends {event.endTime}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/25 p-4 backdrop-blur">
                  <p className="text-sm text-zinc-300">Entry</p>
                  <p className="mt-2 text-lg font-semibold text-white">${event.cover}</p>
                  <p className="mt-1 text-sm text-zinc-400">{event.ageRequirement} • {event.dressCode}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Lineup</p>
              <div className="mt-4 space-y-4">
                {event.supportingActs.map((act) => (
                  <div key={act.name} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{act.name}</p>
                        <p className="mt-1 text-sm text-zinc-400">{act.bio}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-zinc-200">{act.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.35em] text-pink-300/80">Venue details</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <p><span className="font-medium text-white">Address:</span> {event.address}</p>
                  <p><span className="font-medium text-white">Crowd:</span> {event.venueCrowdLevel}</p>
                  <p><span className="font-medium text-white">Capacity:</span> {event.venueCapacity}</p>
                  <p><span className="font-medium text-white">Wait:</span> {event.waitTime}</p>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.35em] text-violet-300/80">Access & policy</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <p><span className="font-medium text-white">Entry:</span> {event.entryPolicy}</p>
                  <p><span className="font-medium text-white">Re-entry:</span> {event.reEntryPolicy}</p>
                  <p><span className="font-medium text-white">Accessibility:</span> {event.accessibility}</p>
                  <p><span className="font-medium text-white">Parking:</span> {event.parking}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[1.6rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Related events</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">More rooms to consider</h2>
              </div>
              <Link href="/events" className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/40 hover:text-white">Back to events</Link>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
              {relatedEvents.map((item) => (
                <Link key={item.id} href={`/events/${item.slug}`} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/40">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">{item.dateLabel}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{item.name}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{item.venueName}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                    {item.genres.slice(0, 2).map((genre) => (
                      <span key={genre} className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1">{genre}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
