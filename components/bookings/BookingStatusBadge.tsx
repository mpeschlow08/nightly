import { getBookingStatusLabel, getBookingStatusTone } from "@/lib/bookings/lifecycle";
import type { BookingLifecycleStatus } from "@/lib/bookings/types";

type BookingStatusBadgeProps = {
  status: BookingLifecycleStatus;
};

export default function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getBookingStatusTone(status)}`}>
      {getBookingStatusLabel(status)}
    </span>
  );
}
