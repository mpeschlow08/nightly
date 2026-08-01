import Link from "next/link";

import { getAdminVenueOsData } from "@/lib/venue-os/data";

export default async function AdminVenueOsOverview() {
  const data = await getAdminVenueOsData();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Admin VenueOS</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Cross-venue operations oversight</h1>
        <p className="mt-3 text-base text-zinc-300">Review VenueOS adoption, staffing records, incidents, campaigns, and AI request volume across the platform.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-3">
          {data.venues.map((venue) => (
            <article key={venue.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">{venue.name}</p>
              <p className="mt-1 text-xs text-zinc-400">{venue.city ?? "Unknown city"} • {venue.publicationStatus}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/admin/review" className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white">Review tools</Link>
                <Link href="/admin/analytics" className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white">Analytics</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}