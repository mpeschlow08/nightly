export const BOOKING_TYPES = [
  "dj_booking",
  "venue_reservation",
  "vip_table_reservation",
  "bottle_service_reservation",
  "private_event_booking",
  "promoter_booking",
  "special_appearance_booking",
] as const;

export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  dj_booking: "DJ Booking",
  venue_reservation: "Venue Reservation",
  vip_table_reservation: "VIP Table Reservation",
  bottle_service_reservation: "Bottle Service Reservation",
  private_event_booking: "Private Event Booking",
  promoter_booking: "Promoter Booking",
  special_appearance_booking: "Special Appearance Booking",
};

export const BOOKING_LIFECYCLE_STATUSES = [
  "draft",
  "requested",
  "pending_review",
  "counter_offered",
  "accepted",
  "deposit_required",
  "deposit_paid",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled_by_consumer",
  "cancelled_by_venue",
  "cancelled_by_dj",
  "expired",
  "refund_pending",
  "refunded",
  "disputed",
  "closed",
] as const;

export type BookingLifecycleStatus = (typeof BOOKING_LIFECYCLE_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingLifecycleStatus, string> = {
  draft: "Draft",
  requested: "Requested",
  pending_review: "Pending Review",
  counter_offered: "Counter Offered",
  accepted: "Accepted",
  deposit_required: "Deposit Required",
  deposit_paid: "Deposit Paid",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  completed: "Completed",
  cancelled_by_consumer: "Cancelled By Consumer",
  cancelled_by_venue: "Cancelled By Venue",
  cancelled_by_dj: "Cancelled By DJ",
  expired: "Expired",
  refund_pending: "Refund Pending",
  refunded: "Refunded",
  disputed: "Disputed",
  closed: "Closed",
};

export const BOOKING_PARTICIPANT_ROLES = [
  "consumer",
  "dj",
  "venue",
  "owner",
  "manager",
  "admin",
  "promoter",
  "system",
] as const;

export type BookingParticipantRole = (typeof BOOKING_PARTICIPANT_ROLES)[number];

export const BOOKING_REVIEW_SUBJECTS = ["dj", "venue", "consumer"] as const;

export type BookingReviewSubject = (typeof BOOKING_REVIEW_SUBJECTS)[number];

export const BOOKING_NOTIFICATION_TYPES = [
  "booking_created",
  "booking_requested",
  "booking_accepted",
  "booking_countered",
  "deposit_due",
  "deposit_paid",
  "booking_reminder",
  "booking_check_in",
  "booking_completed",
  "booking_cancelled",
  "booking_refund",
  "reservation_modified",
  "server_assigned",
  "arrival_reminder",
  "review_reminder",
] as const;

export const CUSTOMER_RESERVATION_STATUS_LABELS: Record<CustomerReservationStatus, string> = {
  pending: "Pending",
  deposit_required: "Deposit Required",
  deposit_paid: "Deposit Paid",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  seated: "Seated",
  bottle_service_active: "Bottle Service Active",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const LIVE_TABLE_STATUS_LABELS: Record<LiveTableStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  cleaning: "Cleaning",
  vip_hold: "VIP Hold",
  out_of_service: "Out Of Service",
};

export type BookingNotificationType = (typeof BOOKING_NOTIFICATION_TYPES)[number];

export const CUSTOMER_RESERVATION_STATUSES = [
  "pending",
  "deposit_required",
  "deposit_paid",
  "confirmed",
  "checked_in",
  "seated",
  "bottle_service_active",
  "completed",
  "cancelled",
  "refunded",
] as const;

export type CustomerReservationStatus = (typeof CUSTOMER_RESERVATION_STATUSES)[number];

export const LIVE_TABLE_STATUSES = [
  "available",
  "reserved",
  "occupied",
  "cleaning",
  "vip_hold",
  "out_of_service",
] as const;

export type LiveTableStatus = (typeof LIVE_TABLE_STATUSES)[number];

export const WAITLIST_STATUSES = [
  "waiting",
  "offered",
  "accepted",
  "expired",
  "cancelled",
  "declined",
  "converted",
] as const;

export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export type BookingRoleContext = {
  clerkUserId: string;
  role: "consumer" | "dj" | "owner" | "admin";
  djProfileId?: number | null;
  venueId?: number | null;
};

export type ReservationActorRole = "consumer" | "owner" | "admin" | "door_staff" | "server" | "system";
