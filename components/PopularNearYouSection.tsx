import Link from "next/link";

import { getVenues } from "@/app/api/venues/lib/venues";

export default async function PopularNearYouSection() {
  const popularVenues = await getVenues();

  return (

    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-violet-300/80">Atlanta</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Popular Near You</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {popularVenues.map((venue) => (
          <article key={venue.id} className="group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className={`relative h-48 bg-gradient-to-br ${venue.imageClass}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.24),_transparent_50%)]" />
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-white">
                <Link href={`/venues/${venue.id}`} className="transition hover:text-cyan-200">
                  {venue.name}
                </Link>
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{venue.city && venue.crowdLevel ? `${venue.city} • ${venue.crowdLevel}` : venue.city}</p>
              <Link href={`/venues/${venue.id}`} className="mt-4 inline-flex text-sm font-medium text-cyan-300 transition group-hover:text-cyan-200">
                Open details →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
