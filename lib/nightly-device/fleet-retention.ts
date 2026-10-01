import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { fleetDeviceAlerts, fleetDeviceOperations, fleetSupportGrants } from "@/db/schema";

export async function pruneFleetHistoryForDevices(deviceIds: number[], now = new Date()) {
  if (!deviceIds.length || deviceIds.length > 100 || new Set(deviceIds).size !== deviceIds.length || deviceIds.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error("A bounded unique device selection is required.");
  const { db } = await import("@/db");
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
  return db.transaction(async (tx) => {
    await tx.update(fleetDeviceOperations).set({ state: "expired", completedAt: now, resultCode: "operation_expired" })
      .where(and(inArray(fleetDeviceOperations.deviceId, deviceIds), inArray(fleetDeviceOperations.state, ["pending", "acknowledged"]), lt(fleetDeviceOperations.expiresAt, now)));
    const alerts = await tx.delete(fleetDeviceAlerts).where(inArray(fleetDeviceAlerts.id,
      tx.select({ id: fleetDeviceAlerts.id }).from(fleetDeviceAlerts).where(and(inArray(fleetDeviceAlerts.deviceId, deviceIds), eq(fleetDeviceAlerts.state, "resolved"), lt(fleetDeviceAlerts.resolvedAt, cutoff)))
        .orderBy(fleetDeviceAlerts.resolvedAt).limit(500),
    )).returning({ id: fleetDeviceAlerts.id });
    const operations = await tx.delete(fleetDeviceOperations).where(inArray(fleetDeviceOperations.id,
      tx.select({ id: fleetDeviceOperations.id }).from(fleetDeviceOperations).where(and(inArray(fleetDeviceOperations.deviceId, deviceIds), inArray(fleetDeviceOperations.state, ["succeeded", "failed", "expired"]), lt(fleetDeviceOperations.completedAt, cutoff)))
        .orderBy(fleetDeviceOperations.completedAt).limit(500),
    )).returning({ id: fleetDeviceOperations.id });
    const grants = await tx.delete(fleetSupportGrants).where(inArray(fleetSupportGrants.id,
      tx.select({ id: fleetSupportGrants.id }).from(fleetSupportGrants).where(and(inArray(fleetSupportGrants.deviceId, deviceIds), lt(fleetSupportGrants.expiresAt, cutoff),
        sql`not exists (select 1 from ${fleetDeviceOperations} where ${fleetDeviceOperations.grantId} = ${fleetSupportGrants.id})`))
        .orderBy(fleetSupportGrants.expiresAt).limit(500),
    )).returning({ id: fleetSupportGrants.id });
    return { alerts: alerts.length, operations: operations.length, grants: grants.length };
  });
}