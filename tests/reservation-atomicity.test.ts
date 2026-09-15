import assert from "node:assert/strict";
import test from "node:test";

import { assertSplitShareTotalMatches } from "@/lib/bookings/split-shares";

class AsyncLockMap {
  private queues = new Map<string, Promise<void>>();

  async withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    this.queues.set(key, previous.then(() => current));

    await previous;
    try {
      return await work();
    } finally {
      releaseCurrent();
      if (this.queues.get(key) === current) {
        this.queues.delete(key);
      }
    }
  }
}

type BookingStatus = "confirmed" | "cancelled" | "expired" | "checked_in" | "completed";

type ReservationRecord = {
  id: number;
  requestKey: string;
  venueId: number;
  tableId: number;
  serverId: number | null;
  inventoryItemId: number | null;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  inventoryReleased: boolean;
  tableReleased: boolean;
  serverReleased: boolean;
  notifications: number;
  auditEntries: number;
};

type WaitlistEntry = {
  id: number;
  status: "waiting" | "offered" | "accepted" | "expired" | "cancelled" | "declined" | "converted";
  expiresAt: number | null;
  notifications: number;
  tableId: number | null;
  bookingRequestKey: string | null;
  inventoryItemId: number | null;
  preferredServerId: number | null;
};

class ReservationSimulator {
  private nextBookingId = 1;
  private nextWaitlistId = 1;
  private locks = new AsyncLockMap();
  private bookings = new Map<string, ReservationRecord>();
  private tableReservations = new Map<number, Array<{ requestKey: string; startAt: string; endAt: string; status: BookingStatus }>>();
  private inventory = new Map<number, { onHand: number; reserved: number }>();
  private serverUsage = new Map<number, Array<{ requestKey: string; startAt: string; endAt: string; guests: number }>>();
  private waitlistBySection = new Map<string, WaitlistEntry[]>();

  constructor() {
    this.inventory.set(1, { onHand: 1, reserved: 0 });
    this.inventory.set(2, { onHand: 2, reserved: 0 });
    this.serverUsage.set(1, []);
    this.serverUsage.set(2, []);
    this.waitlistBySection.set("main", [
      { id: this.nextWaitlistId++, status: "waiting", expiresAt: null, notifications: 0, tableId: null, bookingRequestKey: null, inventoryItemId: null, preferredServerId: null },
      { id: this.nextWaitlistId++, status: "waiting", expiresAt: null, notifications: 0, tableId: null, bookingRequestKey: null, inventoryItemId: null, preferredServerId: null },
    ]);
  }

  private snapshot() {
    return {
      nextBookingId: this.nextBookingId,
      nextWaitlistId: this.nextWaitlistId,
      bookings: new Map(Array.from(this.bookings.entries()).map(([key, value]) => [key, { ...value }])),
      tableReservations: new Map(Array.from(this.tableReservations.entries()).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))])),
      inventory: new Map(Array.from(this.inventory.entries()).map(([key, value]) => [key, { ...value }])),
      serverUsage: new Map(Array.from(this.serverUsage.entries()).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))])),
      waitlistBySection: new Map(Array.from(this.waitlistBySection.entries()).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))])),
    };
  }

  private restore(snapshot: ReturnType<ReservationSimulator["snapshot"]>) {
    this.nextBookingId = snapshot.nextBookingId;
    this.nextWaitlistId = snapshot.nextWaitlistId;
    this.bookings = snapshot.bookings;
    this.tableReservations = snapshot.tableReservations;
    this.inventory = snapshot.inventory;
    this.serverUsage = snapshot.serverUsage;
    this.waitlistBySection = snapshot.waitlistBySection;
  }

  private overlaps(startA: string, endA: string, startB: string, endB: string) {
    return startA < endB && endA > startB;
  }

  private reserveTable(tableId: number, requestKey: string, startAt: string, endAt: string) {
    const rows = this.tableReservations.get(tableId) ?? [];
    if (rows.some((row) => row.status !== "cancelled" && row.status !== "expired" && this.overlaps(row.startAt, row.endAt, startAt, endAt))) {
      throw new Error("Table is already reserved for an overlapping reservation window.");
    }
    rows.push({ requestKey, startAt, endAt, status: "confirmed" });
    this.tableReservations.set(tableId, rows);
  }

  private releaseTable(tableId: number, requestKey: string) {
    const rows = this.tableReservations.get(tableId) ?? [];
    const row = rows.find((entry) => entry.requestKey === requestKey && entry.status === "confirmed");
    if (row) {
      row.status = "cancelled";
    }
  }

  private reserveInventory(itemId: number) {
    const item = this.inventory.get(itemId);
    if (!item || item.onHand - item.reserved < 1) {
      throw new Error("Insufficient inventory.");
    }
    item.reserved += 1;
  }

  private releaseInventory(itemId: number) {
    const item = this.inventory.get(itemId);
    if (item && item.reserved > 0) {
      item.reserved -= 1;
    }
  }

  private reserveServer(serverId: number, requestKey: string, startAt: string, endAt: string, guests: number) {
    const current = this.serverUsage.get(serverId) ?? [];
    const activeTables = current.filter((row) => this.overlaps(row.startAt, row.endAt, startAt, endAt));
    const activeGuests = activeTables.reduce((sum, row) => sum + row.guests, 0);
    if (activeTables.length >= 1 || activeGuests + guests > 10) {
      throw new Error("Preferred server is not available for this reservation.");
    }
    current.push({ requestKey, startAt, endAt, guests });
    this.serverUsage.set(serverId, current);
  }

  private releaseServer(serverId: number, requestKey: string) {
    const rows = this.serverUsage.get(serverId) ?? [];
    const index = rows.findIndex((row) => row.requestKey === requestKey);
    if (index >= 0) {
      rows.splice(index, 1);
    }
  }

  async createReservation(input: {
    requestKey: string;
    venueId?: number;
    tableId: number;
    serverId: number | null;
    inventoryItemId: number | null;
    startAt: string;
    endAt: string;
    guests: number;
    failAfter?: "table" | "inventory" | "server" | "booking_insert";
  }) {
    return this.locks.withLock(`request:${input.requestKey}`, async () => {
      const existing = this.bookings.get(input.requestKey);
      if (existing) {
        return existing;
      }

      const snapshot = this.snapshot();
      try {
        const venueId = input.venueId ?? 1;
        this.reserveTable(input.tableId, input.requestKey, input.startAt, input.endAt);
        if (input.failAfter === "table") {
          throw new Error("boom after table");
        }
        if (input.inventoryItemId != null) {
          this.reserveInventory(input.inventoryItemId);
        }
        if (input.failAfter === "inventory") {
          throw new Error("boom after inventory");
        }
        if (input.serverId != null) {
          this.reserveServer(input.serverId, input.requestKey, input.startAt, input.endAt, input.guests);
        }
        if (input.failAfter === "server") {
          throw new Error("boom after server");
        }

        const booking: ReservationRecord = {
          id: this.nextBookingId++,
          requestKey: input.requestKey,
          venueId,
          tableId: input.tableId,
          serverId: input.serverId,
          inventoryItemId: input.inventoryItemId,
          startAt: input.startAt,
          endAt: input.endAt,
          status: "confirmed",
          inventoryReleased: false,
          tableReleased: false,
          serverReleased: false,
          notifications: 0,
          auditEntries: 1,
        };

        this.bookings.set(input.requestKey, booking);
        if (input.failAfter === "booking_insert") {
          throw new Error("boom after booking insert");
        }
        return booking;
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    });
  }

  async transitionLifecycle(requestKey: string, nextStatus: BookingStatus) {
    return this.locks.withLock(`booking:${requestKey}`, async () => {
      const booking = this.bookings.get(requestKey);
      if (!booking) {
        throw new Error("Booking not found.");
      }

      const releaseStatuses = new Set<BookingStatus>(["cancelled", "expired"]);
      if (booking.status === nextStatus) {
        return booking;
      }
      if (releaseStatuses.has(booking.status) && releaseStatuses.has(nextStatus)) {
        return booking;
      }

      const allowed: Record<BookingStatus, BookingStatus[]> = {
        confirmed: ["checked_in", "cancelled", "expired", "completed"],
        checked_in: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
        expired: [],
      };
      if (!allowed[booking.status].includes(nextStatus)) {
        throw new Error(`Illegal transition ${booking.status} -> ${nextStatus}.`);
      }

      booking.status = nextStatus;
      booking.auditEntries += 1;
      if (nextStatus === "cancelled" || nextStatus === "expired") {
        await this.releaseResources(requestKey);
        booking.notifications += 1;
      }
      return booking;
    });
  }

  private async releaseResources(requestKey: string) {
    const booking = this.bookings.get(requestKey);
    if (!booking) {
      return;
    }
    if (!booking.tableReleased) {
      this.releaseTable(booking.tableId, requestKey);
      booking.tableReleased = true;
    }
    if (booking.inventoryItemId != null && !booking.inventoryReleased) {
      this.releaseInventory(booking.inventoryItemId);
      booking.inventoryReleased = true;
    }
    if (booking.serverId != null && !booking.serverReleased) {
      this.releaseServer(booking.serverId, requestKey);
      booking.serverReleased = true;
    }
  }

  async cancelReservation(requestKey: string, failAfter?: "release") {
    return this.locks.withLock(`booking:${requestKey}`, async () => {
      const snapshot = this.snapshot();
      const booking = this.bookings.get(requestKey);
      if (!booking) {
        return null;
      }
      if (booking.status === "cancelled" || booking.status === "expired") {
        return booking;
      }
      try {
        booking.status = "cancelled";
        await this.releaseResources(requestKey);
        if (failAfter === "release") {
          throw new Error("boom after release");
        }
        booking.notifications += 1;
        booking.auditEntries += 1;
        return booking;
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    });
  }

  async expireReservation(requestKey: string, failAfter?: "release") {
    return this.locks.withLock(`booking:${requestKey}`, async () => {
      const snapshot = this.snapshot();
      const booking = this.bookings.get(requestKey);
      if (!booking) {
        return null;
      }
      if (booking.status === "expired" || booking.status === "cancelled") {
        return booking;
      }
      try {
        booking.status = "expired";
        await this.releaseResources(requestKey);
        if (failAfter === "release") {
          throw new Error("boom after release");
        }
        booking.notifications += 1;
        booking.auditEntries += 1;
        return booking;
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    });
  }

  async promoteWaitlist(section: string, failAfter?: "notification") {
    return this.locks.withLock(`waitlist:${section}`, async () => {
      const snapshot = this.snapshot();
      try {
        const entries = this.waitlistBySection.get(section) ?? [];
        if (entries.some((entry) => entry.status === "offered" && (!entry.expiresAt || entry.expiresAt > Date.now()))) {
          return null;
        }
        const next = entries.find((entry) => entry.status === "waiting");
        if (!next) {
          return null;
        }
        next.status = "offered";
        next.expiresAt = Date.now() + 15 * 60 * 1000;
        next.notifications += 1;
        if (failAfter === "notification") {
          throw new Error("boom after notification");
        }
        return next;
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    });
  }

  async acceptWaitlist(entryId: number, options?: {
    tableId?: number;
    inventoryItemId?: number | null;
    preferredServerId?: number | null;
    failAfter?: "table" | "inventory" | "server" | "booking_insert";
  }) {
    return this.locks.withLock(`waitlist-entry:${entryId}`, async () => {
      for (const [, entries] of this.waitlistBySection.entries()) {
        const entry = entries.find((candidate) => candidate.id === entryId);
        if (!entry) {
          continue;
        }

        if (entry.status === "converted" && entry.bookingRequestKey) {
          return this.bookings.get(entry.bookingRequestKey) ?? null;
        }
        if (entry.status !== "offered") {
          throw new Error("Waitlist offer is not active.");
        }
        if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
          throw new Error("Waitlist offer has expired.");
        }

        const tableId = options?.tableId ?? entry.tableId;
        if (tableId == null) {
          throw new Error("Table is required for waitlist conversion.");
        }

        entry.status = "accepted";
        entry.tableId = tableId;
        entry.inventoryItemId = options?.inventoryItemId ?? entry.inventoryItemId;
        entry.preferredServerId = options?.preferredServerId ?? entry.preferredServerId;

        const requestKey = `waitlist-${entryId}`;
        const booking = await this.createReservation({
          requestKey,
          tableId,
          serverId: entry.preferredServerId,
          inventoryItemId: entry.inventoryItemId,
          startAt: "2026-09-15T20:00:00.000Z",
          endAt: "2026-09-15T21:00:00.000Z",
          guests: 4,
          failAfter: options?.failAfter,
        });

        entry.status = "converted";
        entry.bookingRequestKey = requestKey;
        return booking;
      }

      throw new Error("Waitlist entry not found.");
    });
  }

  async doorAction(requestKey: string, venueId: number) {
    const booking = this.bookings.get(requestKey);
    if (!booking) {
      throw new Error("Booking not found.");
    }
    if (booking.venueId !== venueId) {
      throw new Error("Forbidden");
    }
    return this.transitionLifecycle(requestKey, "checked_in");
  }

  async serverAction(requestKey: string, serverId: number) {
    const booking = this.bookings.get(requestKey);
    if (!booking || booking.serverId !== serverId) {
      throw new Error("Forbidden");
    }
    return booking;
  }

  async walkInConversion(tableId: number, requestKey: string) {
    return this.locks.withLock(`table:${tableId}`, async () => {
      if (this.tableReservations.get(tableId)?.some((row) => row.status === "confirmed")) {
        throw new Error("Table is already reserved for an overlapping reservation window.");
      }
      this.reserveTable(tableId, requestKey, "2026-09-15T20:00:00.000Z", "2026-09-15T21:00:00.000Z");
      return { tableId, requestKey };
    });
  }

  getBooking(requestKey: string) {
    return this.bookings.get(requestKey) ?? null;
  }

  getBookingCount() {
    return this.bookings.size;
  }

  getInventoryReserved(itemId: number) {
    return this.inventory.get(itemId)?.reserved ?? 0;
  }

  setInventoryOnHand(itemId: number, onHand: number) {
    const existing = this.inventory.get(itemId);
    this.inventory.set(itemId, { onHand, reserved: existing?.reserved ?? 0 });
  }

  getTableReservations(tableId: number) {
    return this.tableReservations.get(tableId) ?? [];
  }

  getWaitlist(section: string) {
    return this.waitlistBySection.get(section) ?? [];
  }
}

test("A. two simultaneous waitlist accept requests produce one booking", async () => {
  const simulator = new ReservationSimulator();
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }

  const results = await Promise.allSettled([
    simulator.acceptWaitlist(offered.id, { tableId: 10 }),
    simulator.acceptWaitlist(offered.id, { tableId: 10 }),
  ]);

  assert.equal(results.every((result) => result.status === "fulfilled"), true);
  assert.equal(simulator.getBookingCount(), 1);
});

test("B. waitlist accept races with normal booking on same table", async () => {
  const simulator = new ReservationSimulator();
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }

  const results = await Promise.allSettled([
    simulator.acceptWaitlist(offered.id, { tableId: 11 }),
    simulator.createReservation({ requestKey: "consumer-b", tableId: 11, serverId: null, inventoryItemId: null, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 4 }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("C. waitlist acceptance after expiration is rejected", async () => {
  const simulator = new ReservationSimulator();
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }
  offered.expiresAt = Date.now() - 1;

  await assert.rejects(simulator.acceptWaitlist(offered.id, { tableId: 12 }), /expired/i);
});

test("D. waitlist acceptance after inventory disappears is rejected atomically", async () => {
  const simulator = new ReservationSimulator();
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }
  simulator.setInventoryOnHand(1, 0);

  await assert.rejects(simulator.acceptWaitlist(offered.id, { tableId: 13, inventoryItemId: 1 }), /Insufficient inventory/i);
  assert.equal(simulator.getBookingCount(), 0);
  assert.equal(simulator.getTableReservations(13).length, 0);
});

test("E. waitlist acceptance after preferred server reaches capacity", async () => {
  const simulator = new ReservationSimulator();
  await simulator.createReservation({ requestKey: "server-busy", tableId: 21, serverId: 1, inventoryItemId: null, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 9 });
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }

  await assert.rejects(simulator.acceptWaitlist(offered.id, { tableId: 14, preferredServerId: 1 }), /Preferred server is not available/i);
});

test("F. failure after booking insert during waitlist conversion rolls back", async () => {
  const simulator = new ReservationSimulator();
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }

  await assert.rejects(simulator.acceptWaitlist(offered.id, { tableId: 15, failAfter: "booking_insert" }), /boom after booking insert/i);
  assert.equal(simulator.getBookingCount(), 0);
  assert.equal(simulator.getTableReservations(15).length, 0);
});

test("G. cancellation through two entry points simultaneously", async () => {
  const simulator = new ReservationSimulator();
  await simulator.createReservation({ requestKey: "cancel-g", tableId: 16, serverId: 1, inventoryItemId: 1, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 4 });

  const results = await Promise.allSettled([
    simulator.cancelReservation("cancel-g"),
    simulator.transitionLifecycle("cancel-g", "cancelled"),
  ]);

  assert.equal(results.every((result) => result.status === "fulfilled"), true);
  assert.equal(simulator.getBooking("cancel-g")?.status, "cancelled");
  assert.equal(simulator.getInventoryReserved(1), 0);
});

test("H. expire and cancel race through different paths", async () => {
  const simulator = new ReservationSimulator();
  await simulator.createReservation({ requestKey: "race-h", tableId: 17, serverId: null, inventoryItemId: 1, startAt: "2026-09-15T18:30:00.000Z", endAt: "2026-09-15T19:30:00.000Z", guests: 2 });

  const results = await Promise.allSettled([simulator.cancelReservation("race-h"), simulator.expireReservation("race-h")]);
  assert.equal(results.every((result) => result.status === "fulfilled"), true);
  assert.equal(["cancelled", "expired"].includes(simulator.getBooking("race-h")?.status ?? ""), true);
});

test("I. door check-in and owner cancellation race", async () => {
  const simulator = new ReservationSimulator();
  await simulator.createReservation({ requestKey: "door-owner-i", venueId: 7, tableId: 18, serverId: null, inventoryItemId: null, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 2 });

  const results = await Promise.allSettled([
    simulator.doorAction("door-owner-i", 7),
    simulator.cancelReservation("door-owner-i"),
  ]);

  assert.equal(results.every((result) => result.status === "fulfilled"), true);
  assert.equal(["checked_in", "cancelled"].includes(simulator.getBooking("door-owner-i")?.status ?? ""), true);
});

test("J. unauthorized direct mutation attempt is rejected", async () => {
  const simulator = new ReservationSimulator();
  await simulator.createReservation({ requestKey: "unauthorized-j", venueId: 7, tableId: 19, serverId: null, inventoryItemId: null, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 2 });

  await assert.rejects(simulator.doorAction("unauthorized-j", 8), /Forbidden/);
  await assert.rejects(simulator.serverAction("unauthorized-j", 1), /Forbidden/);
});

test("K. normal booking and waitlist conversion compete for same table", async () => {
  const simulator = new ReservationSimulator();
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }

  const results = await Promise.allSettled([
    simulator.createReservation({ requestKey: "consumer-k", tableId: 20, serverId: null, inventoryItemId: null, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 4 }),
    simulator.acceptWaitlist(offered.id, { tableId: 20 }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("L. normal booking and waitlist conversion compete for final bottle", async () => {
  const simulator = new ReservationSimulator();
  simulator.setInventoryOnHand(1, 1);
  const offered = await simulator.promoteWaitlist("main");
  if (!offered) {
    throw new Error("Expected a promoted waitlist entry.");
  }

  const results = await Promise.allSettled([
    simulator.createReservation({ requestKey: "consumer-l", tableId: 22, serverId: null, inventoryItemId: 1, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 4 }),
    simulator.acceptWaitlist(offered.id, { tableId: 23, inventoryItemId: 1 }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(simulator.getInventoryReserved(1), 1);
});

test("M. lifecycle rollback after release failure", async () => {
  const simulator = new ReservationSimulator();
  await simulator.createReservation({ requestKey: "rollback-m", tableId: 24, serverId: 1, inventoryItemId: 1, startAt: "2026-09-15T20:00:00.000Z", endAt: "2026-09-15T21:00:00.000Z", guests: 3 });
  await assert.rejects(simulator.cancelReservation("rollback-m", "release"), /boom after release/);
  assert.equal(simulator.getBooking("rollback-m")?.status, "confirmed");
  assert.equal(simulator.getInventoryReserved(1), 1);
});

test("split bill forged client total is rejected", () => {
  assert.throws(() => {
    assertSplitShareTotalMatches([{ amountCents: 900 }, { amountCents: 800 }], 2000);
  }, /must match the booking total exactly/i);
});
