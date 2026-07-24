import Link from "next/link";
import { notFound } from "next/navigation";

import { getOwnerEvents, getOwnerUpcomingEventCount, getOwnerVenue, getOwnerVenueImages } from "./lib/data";

export default async function OwnerDashboardPage() {
  const [{ venue }, images, upcomingEventCount, ownerEvents] = await Promise.all([
    getOwnerVenue(),
    getOwnerVenueImages(),
    getOwnerUpcomingEventCount(),
    getOwnerEvents(),
  ]);

  if (!venue) {
    notFound();
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Owner Dashboard</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{venue.name}</h2>
      <p className="mt-2 text-sm text-zinc-300">Venue overview for your current mock owner.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">City</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.city ?? "Not set"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Live Status</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.isLive ? "Live now" : "Not live"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Crowd Level</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.crowdLevel ?? "Unknown"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Total Images</p>
          <p className="mt-2 text-lg font-medium text-white">{images.length}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Upcoming Events</p>
          <p className="mt-2 text-lg font-medium text-white">{upcomingEventCount.count}</p>
          {upcomingEventCount.unavailable ? (
            <p className="mt-2 text-xs text-amber-300">Events table unavailable.</p>
          ) : null}
        </article>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Link href="/owner/venue" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Venue Details</p>
          <p className="mt-2 text-sm text-zinc-300">Update venue profile fields and live status.</p>
        </Link>
        <Link href="/owner/hours" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Business Hours</p>
          <p className="mt-2 text-sm text-zinc-300">Set daily open/close windows and closed days.</p>
        </Link>
        <Link href="/owner/images" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Venue Images</p>
          <p className="mt-2 text-sm text-zinc-300">Add, delete, and reorder gallery images.</p>
        </Link>
        <Link href="/owner/events" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Events</p>
          <p className="mt-2 text-sm text-zinc-300">Create and manage venue event schedule.</p>
        </Link>
      </div>

      {ownerEvents.unavailable ? (
        <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Event CRUD is enabled in the portal UI, but the backing `events` table is not available yet in this environment.
        </div>
      ) : null}
    </section>
  );
}
