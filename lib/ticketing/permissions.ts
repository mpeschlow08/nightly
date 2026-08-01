import type { TicketRoleContext } from "./types";

export type TicketAccessTarget = {
  eventId: number;
  venueId: number;
  userId?: number | null;
  clerkUserId?: string | null;
  promoterProfileId?: number | null;
  doorStaffAssignmentId?: number | null;
};

export function canViewTicket(target: TicketAccessTarget, actor: TicketRoleContext) {
  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "consumer") {
    return actor.userId === target.userId || actor.clerkUserId === target.clerkUserId;
  }

  if (actor.role === "dj" || actor.role === "owner") {
    return actor.venueId === target.venueId;
  }

  if (actor.role === "promoter") {
    return actor.promoterProfileId != null && actor.promoterProfileId === target.promoterProfileId;
  }

  if (actor.role === "door_staff") {
    return actor.doorStaffAssignmentId != null && actor.doorStaffAssignmentId === target.doorStaffAssignmentId;
  }

  return false;
}

export function canScanTicket(target: TicketAccessTarget, actor: TicketRoleContext) {
  if (actor.role === "admin") {
    return true;
  }

  return canViewTicket(target, actor);
}
