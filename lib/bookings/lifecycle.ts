import type { BookingLifecycleStatus, BookingNotificationType, BookingType } from "./types";
import { BOOKING_LIFECYCLE_STATUSES, BOOKING_STATUS_LABELS } from "./types";

export const BOOKING_TERMINAL_STATUSES = new Set<BookingLifecycleStatus>([
  "completed",
  "cancelled_by_consumer",
  "cancelled_by_venue",
  "cancelled_by_dj",
  "expired",
  "refunded",
  "closed",
]);

export const BOOKING_STATUS_TRANSITIONS: Record<BookingLifecycleStatus, BookingLifecycleStatus[]> = {
  draft: ["requested", "cancelled_by_consumer"],
  requested: ["pending_review", "counter_offered", "accepted", "expired", "cancelled_by_consumer"],
  pending_review: ["counter_offered", "accepted", "deposit_required", "expired", "cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj"],
  counter_offered: ["accepted", "cancelled_by_consumer", "expired"],
  accepted: ["deposit_required", "deposit_paid", "confirmed", "cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj"],
  deposit_required: ["deposit_paid", "cancelled_by_consumer", "expired"],
  deposit_paid: ["confirmed", "cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj"],
  confirmed: ["checked_in", "completed", "cancelled_by_consumer", "cancelled_by_venue", "cancelled_by_dj", "refund_pending", "disputed"],
  checked_in: ["completed", "disputed"],
  completed: ["closed", "disputed"],
  cancelled_by_consumer: ["refund_pending", "closed"],
  cancelled_by_venue: ["refund_pending", "closed"],
  cancelled_by_dj: ["refund_pending", "closed"],
  expired: ["closed"],
  refund_pending: ["refunded", "disputed", "closed"],
  refunded: ["closed", "disputed"],
  disputed: ["closed", "refund_pending"],
  closed: [],
};

export const BOOKING_STATUS_SEQUENCE: BookingLifecycleStatus[] = [...BOOKING_LIFECYCLE_STATUSES];

export const BOOKING_STATUS_TONES: Record<BookingLifecycleStatus, string> = {
  draft: "bg-white/10 text-zinc-200 border-white/15",
  requested: "bg-cyan-500/10 text-cyan-100 border-cyan-300/20",
  pending_review: "bg-amber-500/10 text-amber-100 border-amber-300/20",
  counter_offered: "bg-violet-500/10 text-violet-100 border-violet-300/20",
  accepted: "bg-emerald-500/10 text-emerald-100 border-emerald-300/20",
  deposit_required: "bg-orange-500/10 text-orange-100 border-orange-300/20",
  deposit_paid: "bg-emerald-500/15 text-emerald-100 border-emerald-300/25",
  confirmed: "bg-sky-500/10 text-sky-100 border-sky-300/20",
  checked_in: "bg-teal-500/10 text-teal-100 border-teal-300/20",
  completed: "bg-emerald-500/15 text-emerald-100 border-emerald-300/25",
  cancelled_by_consumer: "bg-rose-500/10 text-rose-100 border-rose-300/20",
  cancelled_by_venue: "bg-rose-500/10 text-rose-100 border-rose-300/20",
  cancelled_by_dj: "bg-rose-500/10 text-rose-100 border-rose-300/20",
  expired: "bg-zinc-500/10 text-zinc-200 border-zinc-300/20",
  refund_pending: "bg-amber-500/10 text-amber-100 border-amber-300/20",
  refunded: "bg-emerald-500/10 text-emerald-100 border-emerald-300/20",
  disputed: "bg-fuchsia-500/10 text-fuchsia-100 border-fuchsia-300/20",
  closed: "bg-slate-500/10 text-slate-100 border-slate-300/20",
};

export function getBookingStatusLabel(status: BookingLifecycleStatus) {
  return BOOKING_STATUS_LABELS[status];
}

export function getBookingStatusTone(status: BookingLifecycleStatus) {
  return BOOKING_STATUS_TONES[status];
}

export function isBookingTerminalStatus(status: BookingLifecycleStatus) {
  return BOOKING_TERMINAL_STATUSES.has(status);
}

export function getAllowedBookingTransitions(status: BookingLifecycleStatus) {
  return BOOKING_STATUS_TRANSITIONS[status] ?? [];
}

export function bookingTypeLabels(type: BookingType) {
  switch (type) {
    case "dj_booking":
      return "DJ Booking";
    case "venue_reservation":
      return "Venue Reservation";
    case "vip_table_reservation":
      return "VIP Table Reservation";
    case "bottle_service_reservation":
      return "Bottle Service Reservation";
    case "private_event_booking":
      return "Private Event Booking";
    case "promoter_booking":
      return "Promoter Booking";
    case "special_appearance_booking":
      return "Special Appearance Booking";
    default:
      return type;
  }
}

export function bookingNotificationTypeForStatus(status: BookingLifecycleStatus): BookingNotificationType | null {
  switch (status) {
    case "requested":
      return "booking_requested";
    case "counter_offered":
      return "booking_countered";
    case "accepted":
      return "booking_accepted";
    case "deposit_required":
      return "deposit_due";
    case "deposit_paid":
      return "deposit_paid";
    case "confirmed":
      return "booking_reminder";
    case "checked_in":
      return "booking_check_in";
    case "completed":
      return "booking_completed";
    case "cancelled_by_consumer":
    case "cancelled_by_venue":
    case "cancelled_by_dj":
      return "booking_cancelled";
    case "refund_pending":
    case "refunded":
      return "booking_refund";
    default:
      return null;
  }
}
