import { randomUUID } from "node:crypto";

import Link from "next/link";

import { createTicketOrderAction } from "./actions";
import { getTicketActor } from "./lib/auth";
import { getEventTicketingData, getMyOrders, getMyTickets } from "./lib/data";
import { getUpcomingEvents } from "@/lib/consumer/data";
import { getTicketStatusLabel, getTicketStatusTone } from "@/lib/ticketing/lifecycle";
import type { TicketStatus } from "@/lib/ticketing/types";

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function TicketsPage({ searchParams }: { searchParams?: { event?: string } }) {
  const actor = await getTicketActor();
  const selectedEvent = typeof searchParams?.event === "string" ? searchParams.event : null;
  const [upcomingEvents, myTickets, myOrders, selectedTicketing] = await Promise.all([
    getUpcomingEvents(6),
    getMyTickets(actor.userId, actor.clerkUserId),
    getMyOrders(actor.userId, actor.clerkUserId),
    selectedEvent ? getEventTicketingData(selectedEvent) : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6">
      <header className="rounded-[1.7rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_70px_rgba(8,145,178,0.12)] backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Ticketing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Tickets, guest list, and reservations</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          Purchase or RSVP for events, review your active tickets, and keep every order tied to an auditable lifecycle.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Role: {actor.role}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Orders: {myOrders.length}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Tickets: {myTickets.length}</span>
        </div>
      </header>

      {selectedTicketing ? (
        <section className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Selected Event</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{selectedTicketing.event.title}</h2>
              <p className="mt-1 text-sm text-zinc-300">{selectedTicketing.event.venueName} • {selectedTicketing.event.neighborhood}</p>
              <p className="mt-2 text-sm text-zinc-400">{selectedTicketing.event.ticketStatus} • {selectedTicketing.event.ticketSalesVisibility}</p>
            </div>
            <Link href={`/events/${selectedTicketing.event.slug}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
              View event
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedTicketing.products.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-400">No ticket products are configured yet.</div>
            ) : (
              selectedTicketing.products.map((product) => (
                <article key={product.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{product.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{product.productType}</p>
                    </div>
                    <p className="text-right text-lg font-semibold text-white">{formatMoney(product.priceCents, product.currency)}</p>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{product.description ?? "Tickets for this event."}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Sold {product.quantitySold}</span>
                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Reserved {product.quantityReserved}</span>
                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Total {product.quantityTotal}</span>
                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Limit {product.purchaseLimit}</span>
                  </div>
                  <form action={createTicketOrderAction} className="mt-4 space-y-3">
                    <input type="hidden" name="eventId" value={selectedTicketing.event.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Quantity</span>
                      <input
                        name="quantity"
                        type="number"
                        min={product.minimumQuantity}
                        max={product.maximumQuantity}
                        defaultValue={product.minimumQuantity}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Name on ticket</span>
                      <input
                        name="attendeeName"
                        placeholder="Guest name"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Email</span>
                      <input
                        name="attendeeEmail"
                        type="email"
                        placeholder="guest@example.com"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
                      />
                    </label>
                    <button type="submit" className="w-full rounded-full border border-cyan-400/30 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30">
                      Reserve or issue ticket
                    </button>
                  </form>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">My Tickets</p>
          {myTickets.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No active tickets yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {myTickets.map((ticket) => (
                <li key={ticket.id} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link href={`/tickets/${ticket.id}`} className="text-sm font-semibold text-white hover:text-cyan-200">
                        {ticket.eventTitle}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-400">{ticket.venueName} • {new Date(ticket.eventStartsAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${getTicketStatusTone(ticket.status as TicketStatus)}`}>{getTicketStatusLabel(ticket.status as TicketStatus)}</span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{ticket.productName}</p>
                  <p className="mt-1 text-xs text-zinc-500">Code {ticket.ticketCode}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">My Orders</p>
          {myOrders.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No ticket orders yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {myOrders.map((order) => (
                <li key={order.id} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{order.orderNumber}</p>
                      <p className="mt-1 text-xs text-zinc-400">{order.eventTitle} • {order.venueName}</p>
                    </div>
                    <p className="text-sm font-semibold text-white">{formatMoney(order.totalCents, order.currency)}</p>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">Status: {order.status}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Upcoming Events</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {upcomingEvents.map((event) => (
            <Link key={event.id} href={`/tickets?event=${event.slug}`} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
              <p className="text-sm font-semibold text-white">{event.name}</p>
              <p className="mt-1 text-xs text-zinc-400">{event.venueName}</p>
              <p className="mt-3 text-xs text-zinc-500">{event.ticketStatus}</p>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
