import type { BookingRoleContext } from "./types";

export type BookingAccessTarget = {
  requesterClerkUserId: string;
  consumerClerkUserId: string;
  djProfileId: number | null;
  venueId: number | null;
};

export function canViewBooking(target: BookingAccessTarget, actor: BookingRoleContext) {
  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "consumer") {
    return actor.clerkUserId === target.requesterClerkUserId || actor.clerkUserId === target.consumerClerkUserId;
  }

  if (actor.role === "dj") {
    return actor.djProfileId != null && actor.djProfileId === target.djProfileId;
  }

  if (actor.role === "owner") {
    return actor.venueId != null && actor.venueId === target.venueId;
  }

  return false;
}

export function canMutateBooking(target: BookingAccessTarget, actor: BookingRoleContext) {
  return canViewBooking(target, actor);
}

export function canReviewBooking(target: BookingAccessTarget, actor: BookingRoleContext) {
  return canMutateBooking(target, actor) || actor.role === "admin";
}
