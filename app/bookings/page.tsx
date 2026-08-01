import Link from "next/link";

import BookingListItem from "@/components/bookings/BookingListItem";
import BookingRequestForm from "@/components/bookings/BookingRequestForm";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import { requireConsumerBookingActor } from "./lib/auth";
import { getBookingDashboardData, getBookingRequestOptions } from "./lib/data";
import { createBookingRequestAction } from "./actions";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function BookingsPage() {
  const actor = await requireConsumerBookingActor();
  const [dashboard, requestOptions] = await Promise.all([
    getBookingDashboardData({ actor, pageSize: 8 }),
    getBookingRequestOptions(),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Marketplace</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Your booking workspace</h1>
          <p className="mt-3 max-w-3xl text-base text-zinc-300">
            Create booking requests, track status changes, and keep every quote, payment, and contract in one place.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Open Requests</p>
              <p className="mt-2 text-2xl font-semibold text-white">{dashboard.totalCount}</p>
              <p className="mt-1 text-sm text-zinc-400">All requests in your inbox</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Upcoming</p>
              <p className="mt-2 text-2xl font-semibold text-white">{dashboard.upcomingCount}</p>
              <p className="mt-1 text-sm text-zinc-400">Requests with future start times</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-white">{dashboard.completedCount}</p>
              <p className="mt-1 text-sm text-zinc-400">Finished experiences</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Cancelled</p>
              <p className="mt-2 text-2xl font-semibold text-white">{dashboard.cancelledCount}</p>
              <p className="mt-1 text-sm text-zinc-400">Requests that ended early</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <BookingRequestForm options={requestOptions} action={createBookingRequestAction} />

          <div className="space-y-4 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Recent bookings</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Track your latest requests</h2>
              </div>
              <Link href="/concierge" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
                Concierge
              </Link>
            </div>

            <div className="grid gap-3">
              {dashboard.rows.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                  No bookings yet. Submit your first request to start tracking quotes and contracts.
                </p>
              ) : (
                dashboard.rows.map((booking) => (
                  <BookingListItem key={booking.id} booking={booking} detailHref={`/bookings/${booking.id}`} />
                ))
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(dashboard.counts).map(([status, count]) => (
                <div key={status} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <BookingStatusBadge status={status as Parameters<typeof BookingStatusBadge>[0]["status"]} />
                  <p className="mt-3 text-2xl font-semibold text-white">{count}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
              Your next booking budget window starts at {formatCurrency(50000)} and can be adjusted per request.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
