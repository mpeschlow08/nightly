import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import {
  bookings,
  events,
  ticketOrders,
  venueClaimRequests,
  venueIntelligenceRuns,
  venueMembers,
  venues,
} from "@/db/schema";

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

  const [venue, members, claims, eventRows, bookingRows, orderRows, intelligenceRows] = await Promise.all([
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
  ]);

  if (!venue) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{venue.name}</h1>
      <p className="text-sm text-zinc-300">Venue #{venue.id} • {venue.city ?? "Unknown city"}</p>

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
