import type { TicketOrderStatus, TicketScanDecision, TicketStatus, TicketTransferStatus } from "./types";

export const TICKET_TERMINAL_STATUSES = new Set<TicketStatus>([
  "voided",
  "cancelled",
  "refunded",
  "expired",
  "disputed",
  "chargeback",
  "blocked",
]);

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  reserved: "Reserved",
  pending_payment: "Pending payment",
  issued: "Issued",
  active: "Active",
  transferred: "Transferred",
  transfer_pending: "Transfer pending",
  checked_in: "Checked in",
  partially_checked_in: "Partially checked in",
  voided: "Voided",
  cancelled: "Cancelled",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  expired: "Expired",
  disputed: "Disputed",
  chargeback: "Chargeback",
  blocked: "Blocked",
  replaced: "Replaced",
};

export const TICKET_STATUS_TONES: Record<TicketStatus, string> = {
  reserved: "bg-white/10 text-zinc-200 border-white/15",
  pending_payment: "bg-amber-500/10 text-amber-100 border-amber-300/20",
  issued: "bg-sky-500/10 text-sky-100 border-sky-300/20",
  active: "bg-cyan-500/10 text-cyan-100 border-cyan-300/20",
  transferred: "bg-violet-500/10 text-violet-100 border-violet-300/20",
  transfer_pending: "bg-violet-500/10 text-violet-100 border-violet-300/20",
  checked_in: "bg-emerald-500/10 text-emerald-100 border-emerald-300/20",
  partially_checked_in: "bg-teal-500/10 text-teal-100 border-teal-300/20",
  voided: "bg-zinc-500/10 text-zinc-200 border-zinc-300/20",
  cancelled: "bg-rose-500/10 text-rose-100 border-rose-300/20",
  refund_pending: "bg-amber-500/10 text-amber-100 border-amber-300/20",
  refunded: "bg-emerald-500/10 text-emerald-100 border-emerald-300/20",
  expired: "bg-zinc-500/10 text-zinc-200 border-zinc-300/20",
  disputed: "bg-fuchsia-500/10 text-fuchsia-100 border-fuchsia-300/20",
  chargeback: "bg-fuchsia-500/10 text-fuchsia-100 border-fuchsia-300/20",
  blocked: "bg-rose-500/10 text-rose-100 border-rose-300/20",
  replaced: "bg-slate-500/10 text-slate-100 border-slate-300/20",
};

export const TICKET_ORDER_STATUS_LABELS: Record<TicketOrderStatus, string> = {
  reserved: "Reserved",
  pending_payment: "Pending payment",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  disputed: "Disputed",
  chargeback: "Chargeback",
};

export function getTicketStatusLabel(status: TicketStatus) {
  return TICKET_STATUS_LABELS[status];
}

export function getTicketStatusTone(status: TicketStatus) {
  return TICKET_STATUS_TONES[status];
}

export function isTicketTerminalStatus(status: TicketStatus) {
  return TICKET_TERMINAL_STATUSES.has(status);
}

export function getAllowedTicketTransferStatuses(status: TicketTransferStatus): TicketTransferStatus[] {
  switch (status) {
    case "pending":
      return ["accepted", "cancelled", "expired", "rejected"];
    default:
      return [];
  }
}

export function getScanDecisionLabel(decision: TicketScanDecision) {
  switch (decision) {
    case "valid":
      return "Valid";
    case "duplicate":
      return "Duplicate";
    case "wrong_event":
      return "Wrong event";
    case "wrong_venue":
      return "Wrong venue";
    case "invalid":
      return "Invalid";
    case "blocked":
      return "Blocked";
    case "refunded":
      return "Refunded";
    case "voided":
      return "Voided";
    case "expired":
      return "Expired";
    case "transfer_pending":
      return "Transfer pending";
    case "already_checked_in":
      return "Already checked in";
    case "zone_mismatch":
      return "Zone mismatch";
    case "insufficient_access":
      return "Insufficient access";
    case "reentry_blocked":
      return "Re-entry blocked";
    default:
      return decision;
  }
}
