import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import {
  eventModerationFlags,
  eventRevisionRequests,
  events,
  guestLists,
  ticketOrders,
  ticketProducts,
  tickets,
} from "@/db/schema";

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventDetailPage({ params }: Props) {
  await requireAdminPermission("events:moderate");
  const { eventId } = await params;
  const id = Number.parseInt(eventId, 10);

  if (!Number.isFinite(id)) {
    notFound();
  }

  const [event, products, orders, issuedTickets, flags, revisions, guestListsRows] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, id) }),
    db.select().from(ticketProducts).where(eq(ticketProducts.eventId, id)).orderBy(desc(ticketProducts.createdAt)).limit(30),
    db.select().from(ticketOrders).where(eq(ticketOrders.eventId, id)).orderBy(desc(ticketOrders.createdAt)).limit(30),
    db.select().from(tickets).where(eq(tickets.eventId, id)).orderBy(desc(tickets.createdAt)).limit(30),
    db.select().from(eventModerationFlags).where(eq(eventModerationFlags.eventId, id)).orderBy(desc(eventModerationFlags.createdAt)).limit(30),
    db.select().from(eventRevisionRequests).where(eq(eventRevisionRequests.eventId, id)).orderBy(desc(eventRevisionRequests.createdAt)).limit(30),
    db.select().from(guestLists).where(eq(guestLists.eventId, id)).orderBy(desc(guestLists.createdAt)).limit(30),
  ]);

  if (!event) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{event.title}</h1>
      <p className="text-sm text-zinc-300">Event #{event.id} • Venue #{event.venueId}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Ticketing configuration</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(products, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Sales overview</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify({ orders, issuedTickets }, null, 2)}</pre>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Moderation flags</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(flags, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Revision requests</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(revisions, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Guest list</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(guestListsRows, null, 2)}</pre>
        </article>
      </div>
    </main>
  );
}
