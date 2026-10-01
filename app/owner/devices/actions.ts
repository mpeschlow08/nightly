"use server";

import { createHash } from "node:crypto";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditLogs, fleetDeviceOperations, fleetSupportGrants, nightlyDevices } from "@/db/schema";
import { getCurrentVenueDeviceActor } from "@/lib/nightly-device/auth";
import { canAccessVenueDevice, canUseDeviceForManagement } from "@/lib/nightly-device/policy";
import { consumeRateLimit } from "@/lib/platform/rate-limit";

export async function requestOwnerDeviceRecheck(form: FormData) {
  const actor = await getCurrentVenueDeviceActor();
  const rawId = form.get("deviceId");
  if (!actor || typeof rawId !== "string" || !/^\d{1,10}$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) throw new Error("Device unavailable.");
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 3, sustainedLimit: 3, windowMs: 60_000, route: "owner:device:recheck" }).allowed) throw new Error("Too many rechecks.");
  const deviceId = Number(rawId);
  await db.transaction(async (tx) => {
    const [device] = await tx.select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, lifecycleState: nightlyDevices.lifecycleState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel })
      .from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).for("update").limit(1);
    if (!device || !canAccessVenueDevice({ actor, deviceVenueId: device.venueId, action: "operate" }) || !canUseDeviceForManagement(device)) throw new Error("Device unavailable.");
    const now = new Date();
    const idempotencyKey = `OWNER_RECHECK:${createHash("sha256").update(`${actor.clerkUserId}:${deviceId}:${Math.floor(now.getTime() / 300_000)}`).digest("hex")}`;
    const [existing] = await tx.select({ id: fleetDeviceOperations.id }).from(fleetDeviceOperations)
      .where(and(eq(fleetDeviceOperations.deviceId, deviceId), eq(fleetDeviceOperations.idempotencyKey, idempotencyKey))).limit(1);
    if (existing) return;
    const [pending] = await tx.select({ total: count() }).from(fleetDeviceOperations).where(and(
      eq(fleetDeviceOperations.deviceId, deviceId), inArray(fleetDeviceOperations.state, ["pending", "acknowledged"]), gt(fleetDeviceOperations.expiresAt, now),
    ));
    if (pending.total >= 10) throw new Error("Device is already processing requests.");
    const [activeGrants] = await tx.select({ total: count() }).from(fleetSupportGrants).where(and(
      eq(fleetSupportGrants.deviceId, deviceId), isNull(fleetSupportGrants.revokedAt), gt(fleetSupportGrants.expiresAt, now),
    ));
    if (activeGrants.total >= 5) throw new Error("Too many active Box requests.");
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const [grant] = await tx.insert(fleetSupportGrants).values({ deviceId, actorClerkUserId: actor.clerkUserId, scope: "device.request_health_check", createdAt: now, expiresAt }).returning({ id: fleetSupportGrants.id });
    const [operation] = await tx.insert(fleetDeviceOperations).values({ deviceId, grantId: grant.id, type: "REQUEST_HEALTH_CHECK", idempotencyKey, createdAt: now, expiresAt }).returning({ id: fleetDeviceOperations.id });
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: actor.role, entityType: "nightly_device", entityId: String(deviceId), action: "fleet_owner_recheck_requested", metadataJson: JSON.stringify({ operationId: operation.id }) });
  });
  revalidatePath("/owner/devices");
}