import type { BookingLifecycleStatus, BookingNotificationType, BookingType, CustomerReservationStatus, LiveTableStatus, ReservationActorRole, WaitlistStatus } from "./types";
import { BOOKING_LIFECYCLE_STATUSES, BOOKING_STATUS_LABELS, CUSTOMER_RESERVATION_STATUS_LABELS, LIVE_TABLE_STATUS_LABELS } from "./types";

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

export function mapLifecycleToCustomerStatus(status: BookingLifecycleStatus): CustomerReservationStatus {
  switch (status) {
    case "draft":
    case "requested":
    case "pending_review":
    case "counter_offered":
    case "accepted":
      return "pending";
    case "deposit_required":
      return "deposit_required";
    case "deposit_paid":
      return "deposit_paid";
    case "confirmed":
      return "confirmed";
    case "checked_in":
      return "checked_in";
    case "completed":
    case "closed":
      return "completed";
    case "cancelled_by_consumer":
    case "cancelled_by_venue":
    case "cancelled_by_dj":
    case "expired":
      return "cancelled";
    case "refund_pending":
    case "refunded":
      return "refunded";
    case "disputed":
      return "cancelled";
    default:
      return "pending";
  }
}

export function getCustomerReservationStatusLabel(status: CustomerReservationStatus) {
  return CUSTOMER_RESERVATION_STATUS_LABELS[status] ?? status;
}

export function getLiveTableStatusLabel(status: LiveTableStatus) {
  return LIVE_TABLE_STATUS_LABELS[status] ?? status;
}

export const RESERVATION_STATUS_TRANSITIONS: Record<CustomerReservationStatus, CustomerReservationStatus[]> = {
  pending: ["deposit_required", "confirmed", "cancelled"],
  deposit_required: ["deposit_paid", "cancelled"],
  deposit_paid: ["confirmed", "cancelled", "refunded"],
  confirmed: ["checked_in", "cancelled", "refunded"],
  checked_in: ["seated", "cancelled"],
  seated: ["bottle_service_active", "completed"],
  bottle_service_active: ["completed"],
  completed: [],
  cancelled: ["refunded"],
  refunded: [],
};

export const RESERVATION_STATUS_ALLOWED_ROLES: Record<CustomerReservationStatus, ReservationActorRole[]> = {
  pending: ["owner", "admin", "system"],
  deposit_required: ["owner", "admin", "system"],
  deposit_paid: ["owner", "admin", "system"],
  confirmed: ["owner", "admin", "system"],
  checked_in: ["door_staff", "owner", "admin", "system"],
  seated: ["server", "owner", "admin", "system"],
  bottle_service_active: ["server", "owner", "admin", "system"],
  completed: ["server", "owner", "admin", "system"],
  cancelled: ["consumer", "owner", "admin", "system"],
  refunded: ["owner", "admin", "system"],
};

export const WAITLIST_STATUS_TRANSITIONS: Record<WaitlistStatus, WaitlistStatus[]> = {
  waiting: ["offered", "cancelled", "declined"],
  offered: ["accepted", "expired", "cancelled", "declined", "converted"],
  accepted: ["converted", "cancelled"],
  expired: [],
  cancelled: [],
  declined: [],
  converted: [],
};

export function canTransitionReservationStatus(
  fromStatus: CustomerReservationStatus,
  toStatus: CustomerReservationStatus,
  actorRole: ReservationActorRole,
  conditions?: {
    depositSatisfied?: boolean;
    hasPaymentIssue?: boolean;
  }
) {
  if (fromStatus === toStatus) {
    return { allowed: true } as const;
  }

  const allowedTargets = RESERVATION_STATUS_TRANSITIONS[fromStatus] ?? [];
  if (!allowedTargets.includes(toStatus)) {
    return { allowed: false, reason: `Illegal transition ${fromStatus} -> ${toStatus}.` } as const;
  }

  const allowedRoles = RESERVATION_STATUS_ALLOWED_ROLES[toStatus] ?? [];
  if (!allowedRoles.includes(actorRole)) {
    return { allowed: false, reason: `Role ${actorRole} cannot set status ${toStatus}.` } as const;
  }

  if ((toStatus === "confirmed" || toStatus === "checked_in") && conditions?.depositSatisfied === false) {
    return { allowed: false, reason: "Deposit must be paid before confirming or checking in." } as const;
  }

  if (toStatus === "refunded" && conditions?.hasPaymentIssue === false) {
    return { allowed: false, reason: "Refund status requires a payment/refund pathway." } as const;
  }

  return { allowed: true } as const;
}

export function canTransitionWaitlistStatus(fromStatus: WaitlistStatus, toStatus: WaitlistStatus) {
  if (fromStatus === toStatus) {
    return true;
  }

  return (WAITLIST_STATUS_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export function mapCustomerStatusToBookingLifecycle(status: CustomerReservationStatus, current: BookingLifecycleStatus): BookingLifecycleStatus {
  switch (status) {
    case "pending":
      return current;
    case "deposit_required":
      return "deposit_required";
    case "deposit_paid":
      return "deposit_paid";
    case "confirmed":
      return "confirmed";
    case "checked_in":
      return "checked_in";
    case "seated":
    case "bottle_service_active":
      return "checked_in";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled_by_consumer";
    case "refunded":
      return "refunded";
    default:
      return current;
  }
}

export const LIVE_TABLE_STATUS_TRANSITIONS: Record<LiveTableStatus, LiveTableStatus[]> = {
  available: ["reserved", "vip_hold", "out_of_service"],
  reserved: ["occupied", "available", "vip_hold", "out_of_service"],
  occupied: ["cleaning", "available"],
  cleaning: ["available", "out_of_service"],
  vip_hold: ["reserved", "available", "out_of_service"],
  out_of_service: ["available", "cleaning"],
};

export function canTransitionLiveTableStatus(fromStatus: LiveTableStatus, toStatus: LiveTableStatus) {
  if (fromStatus === toStatus) {
    return true;
  }

  return (LIVE_TABLE_STATUS_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}
