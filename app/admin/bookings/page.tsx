import Link from "next/link";

import BookingListItem from "@/components/bookings/BookingListItem";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import { requireAdminBookingActor } from "@/app/bookings/lib/auth";
import { getBookingDashboardData } from "@/app/bookings/lib/data";

export default async function AdminBookingsPage() {
  const actor = await requireAdminBookingActor();
  const dashboard = await getBookingDashboardData({ actor, pageSize: 12 });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Admin Bookings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Platform-wide booking oversight</h1>
        <p className="mt-3 text-base text-zinc-300">Review every booking, status distribution, and exception path across the marketplace.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(dashboard.counts).map(([status, count]) => (
            <article key={status} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <BookingStatusBadge status={status as Parameters<typeof BookingStatusBadge>[0]["status"]} />
              <p className="mt-3 text-2xl font-semibold text-white">{count}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-3">
          {dashboard.rows.map((booking) => (
            <BookingListItem key={booking.id} booking={booking} detailHref={`/bookings/${booking.id}`} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin/analytics" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
            Analytics
          </Link>
          <Link href="/admin" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
            Admin home
          </Link>
        </div>
      </div>
    </main>
  );
}
