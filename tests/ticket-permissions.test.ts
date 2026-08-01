import assert from "node:assert/strict";
import test from "node:test";

import { canScanTicket, canViewTicket } from "@/lib/ticketing/permissions";
import type { TicketRoleContext } from "@/lib/ticketing/types";

const target = {
  eventId: 42,
  venueId: 8,
  userId: 100,
  clerkUserId: "user_consumer",
  promoterProfileId: 22,
  doorStaffAssignmentId: 300,
};

test("consumer can only view own ticket", () => {
  const owner: TicketRoleContext = {
    clerkUserId: "user_consumer",
    role: "consumer",
    userId: 100,
  };

  const other: TicketRoleContext = {
    clerkUserId: "user_other",
    role: "consumer",
    userId: 101,
  };

  assert.equal(canViewTicket(target, owner), true);
  assert.equal(canViewTicket(target, other), false);
});

test("owner access is scoped to venue", () => {
  const sameVenue: TicketRoleContext = {
    clerkUserId: "owner_1",
    role: "owner",
    userId: 5,
    venueId: 8,
  };

  const otherVenue: TicketRoleContext = {
    clerkUserId: "owner_2",
    role: "owner",
    userId: 6,
    venueId: 9,
  };

  assert.equal(canViewTicket(target, sameVenue), true);
  assert.equal(canViewTicket(target, otherVenue), false);
});

test("door staff access requires assignment match", () => {
  const assigned: TicketRoleContext = {
    clerkUserId: "door_1",
    role: "door_staff",
    userId: 11,
    doorStaffAssignmentId: 300,
    eventId: 42,
    venueId: 8,
  };

  const unassigned: TicketRoleContext = {
    clerkUserId: "door_2",
    role: "door_staff",
    userId: 12,
    doorStaffAssignmentId: 301,
    eventId: 42,
    venueId: 8,
  };

  assert.equal(canViewTicket(target, assigned), true);
  assert.equal(canViewTicket(target, unassigned), false);
  assert.equal(canScanTicket(target, assigned), true);
  assert.equal(canScanTicket(target, unassigned), false);
});
