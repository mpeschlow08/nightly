import Link from "next/link";
import { notFound } from "next/navigation";

import { getVenueBySlug, getVenueSlugs } from "@/data/nightly";

export function generateStaticParams() {
  return getVenueSlugs();
}

export default function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  return <VenueContent params={params} />;
}

async function VenueContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = getVenueBySlug(slug);

  if (!venue) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_40%),linear-gradient(135deg,_#05070c_0%,_#090b12_45%,_#0b1020_100%)] text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-4 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                  {venue.badge ?? "Tonight"}
                </span>
                <span>{venue.neighborhood}</span>
                <span>•</span>
                <span>{venue.distanceMiles.toFixed(1)} mi away</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {venue.name}
                </h1>
                <p className="max-w-2xl text-base text-zinc-300 sm:text-lg">{venue.tagline}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {venue.genres.map((genre) => (
                  <span key={genre} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200">
                    {genre}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300 sm:min-w-[280px]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Crowd</span>
                <span className="font-medium text-white">{venue.crowdLevel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Live now</span>
                <span className="font-medium text-cyan-200">{venue.liveDjName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Cover</span>
                <span className="font-medium text-white">${venue.cover}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Vibe score</span>
                <span className="font-medium text-white">{venue.vibeScore}/100</span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/80 shadow-[0_0_120px_rgba(139,92,246,0.14)]">
            <div className={`h-72 bg-gradient-to-br ${venue.imageClass} p-8 sm:h-80`}>
              <div className="flex h-full flex-col justify-between rounded-[1.5rem] border border-white/10 bg-zinc-950/20 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-zinc-100">
                    Now playing
                  </span>
                  <span className="text-sm text-zinc-100">{venue.currentEvent.startTime}</span>
                </div>
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.35em] text-zinc-200">{venue.currentEvent.djName}</p>
                  <h2 className="text-2xl font-semibold text-white sm:text-3xl">{venue.currentEvent.name}</h2>
                  <p className="max-w-xl text-sm text-zinc-200/90 sm:text-base">
                    {venue.currentEvent.cover > 0 ? `Cover $${venue.currentEvent.cover}` : "No cover"} • {venue.currentEvent.waitTime} wait • {venue.currentEvent.crowdEstimate} energy
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Tonight at a glance</p>
              <div className="space-y-3 text-sm text-zinc-300">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <span>Open until</span>
                  <span className="font-medium text-white">{venue.openUntil}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <span>Wait time</span>
                  <span className="font-medium text-white">{venue.waitTime}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <span>Checked in</span>
                  <span className="font-medium text-white">{venue.checkedIn}</span>
                </div>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-transparent p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Plan your night</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Skip the guesswork and lock in a premium start with a spot near the main room, a quick entry plan, and a backup lounge nearby.
              </p>
              <Link href={`/crews?venue=${encodeURIComponent(venue.name)}`} className="mt-4 inline-flex items-center text-sm font-medium text-cyan-200 transition hover:text-cyan-100">
                Invite a crew for this venue →
              </Link>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(139,92,246,0.12)] backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Venue info</p>
            <div className="mt-5 space-y-4 text-sm text-zinc-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-zinc-400">Address</p>
                <p className="mt-1 font-medium text-white">{venue.address}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-zinc-400">Hours</p>
                <p className="mt-1 font-medium text-white">{venue.hours}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-zinc-400">Dress code</p>
                <p className="mt-1 font-medium text-white">{venue.dressCode}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-zinc-400">Age</p>
                <p className="mt-1 font-medium text-white">{venue.ageRequirement}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-zinc-400">Parking</p>
                <p className="mt-1 font-medium text-white">{venue.parkingInfo}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Upcoming sets</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">The next few nights</h3>
              </div>
              <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
                {venue.upcomingEvents.length} events
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {venue.upcomingEvents.map((event) => (
                <div key={`${event.date}-${event.name}`} className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{event.name}</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {event.date} • {event.time} • {event.djName}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-zinc-200">{event.genre}</p>
                      <p className="text-sm text-zinc-400">Cover ${event.cover}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(139,92,246,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Amenities</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">What to expect on arrival</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {venue.amenities.map((amenity) => (
                <span key={amenity} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200">
                  {amenity}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              <p className="text-zinc-400">Contact</p>
              <p className="mt-2 font-medium text-white">{venue.phoneNumber}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              <p className="text-zinc-400">Instagram</p>
              <p className="mt-2 font-medium text-white">{venue.instagram}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              <p className="text-zinc-400">Website</p>
              <p className="mt-2 font-medium text-white">{venue.website}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              <p className="text-zinc-400">Best for</p>
              <p className="mt-2 font-medium text-white">High-energy groups</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
