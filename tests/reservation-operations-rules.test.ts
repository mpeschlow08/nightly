import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionLiveTableStatus,
  canTransitionReservationStatus,
  canTransitionWaitlistStatus,
  mapCustomerStatusToBookingLifecycle,
} from "@/lib/bookings/lifecycle";
import { createReservationPassToken, parseReservationPassToken } from "@/lib/bookings/pass-token";

test("reservation lifecycle allows valid owner transition", () => {
  const result = canTransitionReservationStatus("confirmed", "checked_in", "owner", { depositSatisfied: true });
  assert.equal(result.allowed, true);
});

test("reservation lifecycle rejects invalid backward transition", () => {
  const result = canTransitionReservationStatus("completed", "checked_in", "owner", { depositSatisfied: true });
  assert.equal(result.allowed, false);
});

test("reservation lifecycle enforces role restrictions", () => {
  const result = canTransitionReservationStatus("confirmed", "checked_in", "consumer", { depositSatisfied: true });
  assert.equal(result.allowed, false);
});

test("reservation lifecycle enforces deposit condition", () => {
  const result = canTransitionReservationStatus("confirmed", "checked_in", "door_staff", { depositSatisfied: false });
  assert.equal(result.allowed, false);
});

test("live table status transition accepts cleaning to available", () => {
  assert.equal(canTransitionLiveTableStatus("cleaning", "available"), true);
});

test("live table status transition rejects occupied to vip hold", () => {
  assert.equal(canTransitionLiveTableStatus("occupied", "vip_hold"), false);
});

test("waitlist transition accepts offered to accepted", () => {
  assert.equal(canTransitionWaitlistStatus("offered", "accepted"), true);
});

test("waitlist transition rejects converted to waiting", () => {
  assert.equal(canTransitionWaitlistStatus("converted", "waiting"), false);
});

test("customer status maps to booking lifecycle consistently", () => {
  assert.equal(mapCustomerStatusToBookingLifecycle("bottle_service_active", "checked_in"), "checked_in");
  assert.equal(mapCustomerStatusToBookingLifecycle("cancelled", "confirmed"), "cancelled_by_consumer");
});

test("reservation pass token round-trips valid claims", () => {
  const token = createReservationPassToken({
    bid: 42,
    vid: 8,
    iat: 1700000000,
    exp: 1700003600,
    ver: 1,
  });

  const parsed = parseReservationPassToken(token);
  assert.ok(parsed);
  assert.equal(parsed?.bid, 42);
  assert.equal(parsed?.vid, 8);
  assert.equal(parsed?.exp, 1700003600);
});

test("reservation pass token rejects tampered signature", () => {
  const token = createReservationPassToken({
    bid: 50,
    vid: 11,
    iat: 1700000000,
    exp: 1700003600,
    ver: 1,
  });

  const tampered = `${token.slice(0, -1)}x`;
  assert.equal(parseReservationPassToken(tampered), null);
});
