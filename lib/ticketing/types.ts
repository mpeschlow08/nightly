export const TICKET_PRODUCT_TYPES = [
  "free_rsvp",
  "general_admission",
  "early_bird",
  "tiered_admission",
  "vip_admission",
  "backstage_admission",
  "guest_list",
  "promoter_guest_list",
  "venue_comp",
  "staff_comp",
  "table_reservation",
  "bottle_service",
  "private_event_invitation",
  "group_bundle",
  "timed_entry",
  "custom_tier",
  "door_sale",
] as const;

export type TicketProductType = (typeof TICKET_PRODUCT_TYPES)[number];

export const TICKET_ORDER_STATUSES = [
  "reserved",
  "pending_payment",
  "completed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "disputed",
  "chargeback",
] as const;

export type TicketOrderStatus = (typeof TICKET_ORDER_STATUSES)[number];

export const TICKET_STATUSES = [
  "reserved",
  "pending_payment",
  "issued",
  "active",
  "transferred",
  "transfer_pending",
  "checked_in",
  "partially_checked_in",
  "voided",
  "cancelled",
  "refund_pending",
  "refunded",
  "expired",
  "disputed",
  "chargeback",
  "blocked",
  "replaced",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TRANSFER_STATUSES = ["pending", "accepted", "cancelled", "expired", "rejected"] as const;
export type TicketTransferStatus = (typeof TICKET_TRANSFER_STATUSES)[number];

export const TICKET_SCAN_DECISIONS = [
  "valid",
  "duplicate",
  "wrong_event",
  "wrong_venue",
  "invalid",
  "blocked",
  "refunded",
  "voided",
  "expired",
  "transfer_pending",
  "already_checked_in",
  "zone_mismatch",
  "insufficient_access",
  "reentry_blocked",
] as const;
export type TicketScanDecision = (typeof TICKET_SCAN_DECISIONS)[number];

export const GUEST_LIST_ENTRY_STATUSES = [
  "invited",
  "requested",
  "approved",
  "waitlisted",
  "denied",
  "checked_in",
  "partially_checked_in",
  "no_show",
  "cancelled",
  "expired",
  "blocked",
] as const;
export type GuestListEntryStatus = (typeof GUEST_LIST_ENTRY_STATUSES)[number];

export const TICKET_SALES_VISIBILITIES = ["public", "private", "invite_only", "hidden"] as const;
export type TicketSalesVisibility = (typeof TICKET_SALES_VISIBILITIES)[number];

export type TicketRoleContext = {
  clerkUserId: string;
  role: "consumer" | "dj" | "owner" | "admin" | "promoter" | "door_staff";
  userId: number;
  venueId?: number | null;
  eventId?: number | null;
  promoterProfileId?: number | null;
  doorStaffAssignmentId?: number | null;
};

export type TicketTokenPayload = {
  version: number;
  tokenId: string;
};
