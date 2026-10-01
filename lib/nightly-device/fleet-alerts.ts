import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";

import { fleetDeviceAlerts, nightlyDevices } from "@/db/schema";
import type { FleetTelemetry } from "./telemetry";
import type { FleetConnectivity } from "./policy";

type AlertCode = "DEVICE_OFFLINE" | "MEMORY_PRESSURE" | "COMMERCIAL_SUSPENSION" | "STORAGE_LOW" | "STORAGE_CRITICAL" | "CAMERA_OFFLINE" | "ALL_CAPTURE_SOURCES_UNAVAILABLE" | "UPLOAD_BACKLOG";
type AlertSeverity = "info" | "warning" | "critical";
export type FleetAlertCondition = { code: AlertCode; severity: AlertSeverity };

const managedCodes: AlertCode[] = ["DEVICE_OFFLINE", "MEMORY_PRESSURE", "COMMERCIAL_SUSPENSION", "STORAGE_LOW", "STORAGE_CRITICAL", "CAMERA_OFFLINE", "ALL_CAPTURE_SOURCES_UNAVAILABLE", "UPLOAD_BACKLOG"];

export function fleetAlertConditions(input: {
  connectivity: FleetConnectivity;
  commercialState: string;
  telemetry: FleetTelemetry | null;
}): FleetAlertCondition[] {
  const conditions: FleetAlertCondition[] = [];
  if (input.connectivity === "offline") conditions.push({ code: "DEVICE_OFFLINE", severity: "critical" });
  if (input.connectivity === "online" && input.telemetry) {
    const freeRatio = input.telemetry.memoryAvailableBytes / input.telemetry.memoryTotalBytes;
    if (freeRatio < 0.05) conditions.push({ code: "MEMORY_PRESSURE", severity: "critical" });
    else if (freeRatio < 0.1) conditions.push({ code: "MEMORY_PRESSURE", severity: "warning" });
    if (input.telemetry.storageTotalBytes && input.telemetry.storageFreeBytes !== undefined) {
      const storageRatio = input.telemetry.storageFreeBytes / input.telemetry.storageTotalBytes;
      if (storageRatio < 0.05) conditions.push({ code: "STORAGE_CRITICAL", severity: "critical" });
      else if (storageRatio < 0.15) conditions.push({ code: "STORAGE_LOW", severity: "warning" });
    }
    if (input.telemetry.cameraCount && input.telemetry.healthyCameraCount !== undefined) {
      if (input.telemetry.healthyCameraCount === 0) conditions.push({ code: "ALL_CAPTURE_SOURCES_UNAVAILABLE", severity: "critical" });
      else if (input.telemetry.healthyCameraCount < input.telemetry.cameraCount) conditions.push({ code: "CAMERA_OFFLINE", severity: "warning" });
    }
    if (input.telemetry.uploadQueueDepth !== undefined && input.telemetry.uploadQueueDepth >= 50) conditions.push({ code: "UPLOAD_BACKLOG", severity: input.telemetry.uploadQueueDepth >= 500 ? "critical" : "warning" });
  }
  if (input.commercialState === "suspended") conditions.push({ code: "COMMERCIAL_SUSPENSION", severity: "info" });
  return conditions;
}

export async function reconcileFleetAlerts(deviceId: number, conditions: FleetAlertCondition[], now = new Date(), monitoredCodes: AlertCode[] = managedCodes) {
  const { db } = await import("@/db");
  const activeCodes = conditions.map((condition) => condition.code);
  await db.transaction(async (tx) => {
    const resolved = await tx.update(fleetDeviceAlerts).set({ state: "resolved", resolvedAt: now, lastObservedAt: now })
      .where(and(eq(fleetDeviceAlerts.deviceId, deviceId), ne(fleetDeviceAlerts.state, "resolved"), inArray(fleetDeviceAlerts.code, monitoredCodes),
        ...(activeCodes.length ? [notInArray(fleetDeviceAlerts.code, activeCodes)] : []))).returning({ code: fleetDeviceAlerts.code });
    if (resolved.some((alert) => alert.code === "DEVICE_OFFLINE")) {
      await tx.insert(fleetDeviceAlerts).values({ deviceId, code: "DEVICE_RECONNECTED", severity: "info", state: "resolved", firstObservedAt: now, lastObservedAt: now, resolvedAt: now });
    }
    for (const condition of conditions) {
      await tx.insert(fleetDeviceAlerts).values({ deviceId, ...condition, firstObservedAt: now, lastObservedAt: now })
        .onConflictDoUpdate({
          target: [fleetDeviceAlerts.deviceId, fleetDeviceAlerts.code],
          targetWhere: sql`${fleetDeviceAlerts.state} <> 'resolved'`,
          set: { severity: condition.severity, lastObservedAt: now, occurrenceCount: sql`least(${fleetDeviceAlerts.occurrenceCount} + 1, 2147483647)` },
        });
    }
  });
}

export async function reconcileOfflineAlertsForDevices(deviceIds: number[], now = new Date()) {
  if (!deviceIds.length || deviceIds.length > 100 || new Set(deviceIds).size !== deviceIds.length || deviceIds.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error("A bounded set of unique device IDs is required.");
  const { db } = await import("@/db");
  const threshold = new Date(now.getTime() - 5 * 60_000);
  await db.transaction(async (tx) => {
    await tx.select({ id: nightlyDevices.id }).from(nightlyDevices).where(inArray(nightlyDevices.id, deviceIds))
      .orderBy(nightlyDevices.id).for("update");
    await tx.update(fleetDeviceAlerts).set({ state: "resolved", resolvedAt: now, lastObservedAt: now })
      .where(and(inArray(fleetDeviceAlerts.deviceId, deviceIds), eq(fleetDeviceAlerts.code, "DEVICE_OFFLINE"), ne(fleetDeviceAlerts.state, "resolved"),
        sql`exists (select 1 from ${nightlyDevices} where ${nightlyDevices.id} = ${fleetDeviceAlerts.deviceId} and (${nightlyDevices.lastHeartbeatAt} >= ${threshold} or ${nightlyDevices.lifecycleState} in ('retired','revoked','return_pending','rma')))`));
    await tx.execute(sql`insert into ${fleetDeviceAlerts} (device_id, code, severity, state, first_observed_at, last_observed_at, occurrence_count)
      select ${nightlyDevices.id}, 'DEVICE_OFFLINE', 'critical', 'open', ${now}, ${now}, 1 from ${nightlyDevices}
      where ${inArray(nightlyDevices.id, deviceIds)} and ${nightlyDevices.claimState} = 'claimed'
        and ${nightlyDevices.lastHeartbeatAt} < ${threshold} and ${nightlyDevices.lifecycleState} not in ('retired','revoked','return_pending','rma')
      on conflict (device_id, code) where state <> 'resolved' do update set
        last_observed_at = greatest(fleet_device_alerts.last_observed_at, excluded.last_observed_at)`);
  });
}