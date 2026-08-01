import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import {
  runVenueGoogleRefreshAction,
  setVenueGoogleRefreshSuspendedAction,
} from "@/app/admin/actions";
import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import {
  bookings,
  events,
  ticketOrders,
  venueDataRefreshItems,
  venueDataRefreshRuns,
  venueClaimRequests,
  venueIntelligenceRuns,
  venueMembers,
  venues,
} from "@/db/schema";
import { getSchedulerState } from "@/lib/platform/venue-google-refresh";

type Props = {
  params: Promise<{ venueId: string }>;
};

export default async function AdminVenueDetailPage({ params }: Props) {
  await requireAdminPermission("venues:view");
  const { venueId } = await params;
  const id = Number.parseInt(venueId, 10);

  if (!Number.isFinite(id)) {
    notFound();
  }

  const [
    venue,
    members,
    claims,
    eventRows,
    bookingRows,
    orderRows,
    intelligenceRows,
    refreshRuns,
    refreshItems,
  ] = await Promise.all([
    db.query.venues.findFirst({ where: eq(venues.id, id) }),
    db.select().from(venueMembers).where(eq(venueMembers.venueId, id)).orderBy(desc(venueMembers.createdAt)).limit(30),
    db.select().from(venueClaimRequests).where(eq(venueClaimRequests.venueId, id)).orderBy(desc(venueClaimRequests.createdAt)).limit(30),
    db.select().from(events).where(eq(events.venueId, id)).orderBy(desc(events.createdAt)).limit(30),
    db.select().from(bookings).where(eq(bookings.venueId, id)).orderBy(desc(bookings.createdAt)).limit(30),
    db.execute(sql`
      select o.*
      from ticket_orders o
      join events e on e.id = o.event_id
      where e.venue_id = ${id}
      order by o.created_at desc
      limit 30
    `),
    db.select().from(venueIntelligenceRuns).where(eq(venueIntelligenceRuns.venueId, id)).orderBy(desc(venueIntelligenceRuns.createdAt)).limit(30),
    db
      .select()
      .from(venueDataRefreshRuns)
      .orderBy(desc(venueDataRefreshRuns.createdAt))
      .limit(20),
    db
      .select()
      .from(venueDataRefreshItems)
      .where(eq(venueDataRefreshItems.venueId, id))
      .orderBy(desc(venueDataRefreshItems.createdAt))
      .limit(20),
  ]);

  const schedulerState = getSchedulerState();

  if (!venue) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{venue.name}</h1>
      <p className="text-sm text-zinc-300">Venue #{venue.id} • {venue.city ?? "Unknown city"}</p>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Google Data Refresh Controls</h2>
        <p className="mt-1 text-sm text-zinc-300">
          Scheduler: {schedulerState} • Status: {venue.googleRefreshStatus} • Last checked: {venue.googleDataLastFetchedAt ? venue.googleDataLastFetchedAt.toISOString() : "never"}
        </p>
        {venue.googleRefreshStatus === "relink_required" ? (
          <p className="mt-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            This venue requires Google relink confirmation. Ask the owner to re-run the import flow in Owner Venue settings.
          </p>
        ) : null}
        {venue.googleRefreshError ? (
          <p className="mt-2 text-xs text-rose-200">Latest refresh error: {venue.googleRefreshError}</p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <form action={runVenueGoogleRefreshAction} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-medium text-white">Refresh this venue</p>
            <input type="hidden" name="mode" value="single" />
            <input type="hidden" name="venueId" value={venue.id} />
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" name="dryRun" value="true" className="h-4 w-4 accent-cyan-500" />
                Dry run
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" name="force" value="true" className="h-4 w-4 accent-cyan-500" />
                Force
              </label>
            </div>
            <button type="submit" className="mt-3 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100">
              Run now
            </button>
          </form>

          <form action={setVenueGoogleRefreshSuspendedAction} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-medium text-white">Suspend automatic refresh eligibility</p>
            <input type="hidden" name="venueId" value={venue.id} />
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                name="suspend"
                value="true"
                defaultChecked={Boolean(venue.googleRefreshSuspendedAt)}
                className="h-4 w-4 accent-amber-500"
              />
              Suspend this venue from stale/batch refresh jobs
            </label>
            <input
              type="text"
              name="reason"
              required
              placeholder="Reason for change"
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
            />
            <button type="submit" className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-2 text-sm text-amber-100">
              Save suspension state
            </button>
          </form>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-black/20 p-3">
            <h3 className="text-sm font-semibold text-white">Recent refresh runs</h3>
            <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(refreshRuns, null, 2)}</pre>
          </article>
          <article className="rounded-xl border border-white/10 bg-black/20 p-3">
            <h3 className="text-sm font-semibold text-white">This venue run items</h3>
            <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(refreshItems, null, 2)}</pre>
          </article>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Owners / Managers</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(members, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Claim history</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(claims, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Intelligence runs</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(intelligenceRows, null, 2)}</pre>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Events</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(eventRows, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Bookings</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(bookingRows, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Ticket orders</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(orderRows.rows, null, 2)}</pre>
        </article>
      </div>
    </main>
  );
}
