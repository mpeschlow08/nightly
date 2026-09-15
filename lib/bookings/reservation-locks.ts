import { sql } from "drizzle-orm";

import { db } from "@/db";

export const RESERVATION_LOCK_SCOPE = {
  bookingRequest: 8101,
  booking: 8102,
  table: 8103,
  server: 8104,
  inventoryItem: 8105,
  waitlistEntry: 8106,
  waitlistSection: 8107,
} as const;

type ReservationDbClient = Pick<typeof db, "execute">;

export async function acquireAdvisoryLock(client: ReservationDbClient, scope: number, resourceId: number) {
  await client.execute(sql`select pg_advisory_xact_lock(${scope}, ${resourceId})`);
}

export function stableIntHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}
