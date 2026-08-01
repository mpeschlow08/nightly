import Link from "next/link";

import BookingStatusBadge from "./BookingStatusBadge";
import { bookingTypeLabels } from "@/lib/bookings/lifecycle";
import type { BookingDashboardRow } from "@/app/bookings/lib/data";

type BookingListItemProps = {
  booking: BookingDashboardRow;
  detailHref: string;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function BookingListItem({ booking, detailHref }: BookingListItemProps) {
  return (
    <Link href={detailHref} className="block rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{booking.bookingNumber}</p>
          <h4 className="mt-2 text-base font-semibold text-white">{bookingTypeLabels(booking.bookingType)}</h4>
          <p className="mt-1 text-sm text-zinc-400">
            {booking.city ?? "City not set"}
            {booking.djName ? ` • ${booking.djName}` : ""}
            {booking.venueName ? ` • ${booking.venueName}` : ""}
          </p>
        </div>
        <BookingStatusBadge status={booking.lifecycleStatus} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Date</p>
          <p className="mt-1">{booking.requestedStartAt ? booking.requestedStartAt.toLocaleString() : "Not scheduled"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Guests</p>
          <p className="mt-1">{booking.guestCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Value</p>
          <p className="mt-1">{formatCurrency(booking.totalCents || booking.budgetCents)}</p>
        </div>
      </div>
    </Link>
  );
}
