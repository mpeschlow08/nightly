"use server";

import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { auditLogs, fleetDeviceAlerts, fleetDeviceOperations, fleetSupportGrants, fleetUpdateRollouts, fleetUpdateTargets, nightlyDevices } from "@/db/schema";
import { supportGrantAllowsOperation } from "@/lib/nightly-device/fleet-operations";
import { reconcileOfflineAlertsForDevices } from "@/lib/nightly-device/fleet-alerts";
import { scheduleSignedFleetCanary } from "@/lib/nightly-device/fleet-canary";
import { pruneFleetHistoryForDevices } from "@/lib/nightly-device/fleet-retention";
import type { SignedUpdateManifest } from "@/agent/src/core/ota";
import { canUseDeviceForManagement } from "@/lib/nightly-device/policy";
import { consumeRateLimit } from "@/lib/platform/rate-limit";

const grantScopes = ["device.read_diagnostics", "device.request_health_check", "device.collect_support_bundle"] as const;

function parseId(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw new Error("Invalid device identifier.");
  return Number(value);
}

export async function createFleetSupportGrant(form: FormData) {
  const actor = await requireAdminPermission("support:resolve");
  const deviceId = parseId(form.get("deviceId"));
  const scope = form.get("scope");
  if (typeof scope !== "string" || !grantScopes.includes(scope as typeof grantScopes[number])) throw new Error("Unsupported support scope.");
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 5, sustainedLimit: 5, windowMs: 60_000, route: "admin:fleet:grant" }).allowed) throw new Error("Too many support requests.");
  const now = new Date();
  await db.transaction(async (tx) => {
    const [device] = await tx.select({ id: nightlyDevices.id, lifecycleState: nightlyDevices.lifecycleState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel })
      .from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).for("update").limit(1);
    if (!device || !canUseDeviceForManagement(device)) throw new Error("Device support is unavailable.");
    const [active] = await tx.select({ total: count() }).from(fleetSupportGrants)
      .where(and(eq(fleetSupportGrants.deviceId, deviceId), isNull(fleetSupportGrants.revokedAt), gt(fleetSupportGrants.expiresAt, now)));
    if (active.total >= 5) throw new Error("Too many active support grants for this Box.");
    const [grant] = await tx.insert(fleetSupportGrants).values({ deviceId, actorClerkUserId: actor.clerkUserId, scope, createdAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000) }).returning({ id: fleetSupportGrants.id });
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "nightly_device", entityId: String(deviceId), action: "fleet_support_grant_created", metadataJson: JSON.stringify({ grantId: grant.id, scope }) });
  });
  revalidatePath(`/admin/fleet/${deviceId}`);
}

export async function revokeFleetSupportGrant(form: FormData) {
  const actor = await requireAdminPermission("support:resolve");
  const deviceId = parseId(form.get("deviceId"));
  const grantId = parseId(form.get("grantId"));
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 10, sustainedLimit: 10, windowMs: 60_000, route: "admin:fleet:revoke-grant" }).allowed) throw new Error("Too many grant updates.");
  const now = new Date();
  await db.transaction(async (tx) => {
    const [grant] = await tx.update(fleetSupportGrants).set({ revokedAt: now }).where(and(
      eq(fleetSupportGrants.id, grantId), eq(fleetSupportGrants.deviceId, deviceId),
      eq(fleetSupportGrants.actorClerkUserId, actor.clerkUserId), isNull(fleetSupportGrants.revokedAt),
    )).returning({ id: fleetSupportGrants.id });
    if (!grant) throw new Error("Support grant is unavailable.");
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "nightly_device", entityId: String(deviceId), action: "fleet_support_grant_revoked", metadataJson: JSON.stringify({ grantId }) });
  });
  revalidatePath(`/admin/fleet/${deviceId}`);
}

export async function requestFleetHealthCheck(form: FormData) {
  const actor = await requireAdminPermission("support:resolve");
  const deviceId = parseId(form.get("deviceId"));
  const grantId = parseId(form.get("grantId"));
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 5, sustainedLimit: 5, windowMs: 60_000, route: "admin:fleet:health-check" }).allowed) throw new Error("Too many health check requests.");
  await db.transaction(async (tx) => {
    const [device] = await tx.select({ id: nightlyDevices.id, lifecycleState: nightlyDevices.lifecycleState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel })
      .from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).for("update").limit(1);
    if (!device || !canUseDeviceForManagement(device)) throw new Error("Device support is unavailable.");
    const [grant] = await tx.select().from(fleetSupportGrants)
      .where(and(eq(fleetSupportGrants.id, grantId), eq(fleetSupportGrants.deviceId, deviceId))).for("update").limit(1);
    const now = new Date();
    if (!grant || !supportGrantAllowsOperation(grant, actor.clerkUserId, deviceId, "REQUEST_HEALTH_CHECK", now)) throw new Error("Support authorization is unavailable.");
    const [existing] = await tx.select({ id: fleetDeviceOperations.id }).from(fleetDeviceOperations).where(and(
      eq(fleetDeviceOperations.deviceId, deviceId), eq(fleetDeviceOperations.idempotencyKey, `REQUEST_HEALTH_CHECK:${grantId}`),
    )).limit(1);
    if (existing) return;
    const [pending] = await tx.select({ total: count() }).from(fleetDeviceOperations).where(and(
      eq(fleetDeviceOperations.deviceId, deviceId), inArray(fleetDeviceOperations.state, ["pending", "acknowledged"]), gt(fleetDeviceOperations.expiresAt, now),
    ));
    if (pending.total >= 10) throw new Error("Too many pending Box operations.");
    const [operation] = await tx.insert(fleetDeviceOperations).values({ deviceId, grantId, type: "REQUEST_HEALTH_CHECK", idempotencyKey: `REQUEST_HEALTH_CHECK:${grantId}`, createdAt: now, expiresAt: new Date(Math.min(now.getTime() + 5 * 60_000, grant.expiresAt.getTime())) })
      .onConflictDoNothing({ target: [fleetDeviceOperations.deviceId, fleetDeviceOperations.idempotencyKey] }).returning({ id: fleetDeviceOperations.id });
    if (operation) await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "nightly_device", entityId: String(deviceId), action: "fleet_health_check_requested", metadataJson: JSON.stringify({ operationId: operation.id, grantId }) });
  });
  revalidatePath(`/admin/fleet/${deviceId}`);
}

export async function refreshFleetAlertState(form: FormData) {
  const actor = await requireAdminPermission("jobs:manage");
  const values = form.getAll("deviceId");
  if (!values.length || values.length > 100) throw new Error("A bounded device selection is required.");
  const ids = values.map(parseId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate device selection.");
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 3, sustainedLimit: 3, windowMs: 60_000, route: "admin:fleet:refresh-alerts" }).allowed) throw new Error("Too many alert refreshes.");
  await reconcileOfflineAlertsForDevices(ids);
  await db.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "fleet", entityId: "device_alerts", action: "fleet_alerts_refreshed", metadataJson: JSON.stringify({ deviceCount: ids.length }) });
  revalidatePath("/admin/fleet");
}

export async function acknowledgeFleetAlert(form: FormData) {
  const actor = await requireAdminPermission("support:resolve");
  const deviceId = parseId(form.get("deviceId"));
  const alertId = parseId(form.get("alertId"));
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 10, sustainedLimit: 10, windowMs: 60_000, route: "admin:fleet:ack-alert" }).allowed) throw new Error("Too many alert updates.");
  await db.transaction(async (tx) => {
    const [alert] = await tx.update(fleetDeviceAlerts).set({ state: "acknowledged", acknowledgedAt: new Date() })
      .where(and(eq(fleetDeviceAlerts.id, alertId), eq(fleetDeviceAlerts.deviceId, deviceId), eq(fleetDeviceAlerts.state, "open")))
      .returning({ code: fleetDeviceAlerts.code });
    if (!alert) throw new Error("Alert is not open for this Box.");
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "nightly_device", entityId: String(deviceId), action: "fleet_alert_acknowledged", metadataJson: JSON.stringify({ alertId, code: alert.code }) });
  });
  revalidatePath(`/admin/fleet/${deviceId}`);
  revalidatePath("/admin/fleet");
}

export async function scheduleFleetCanary(form: FormData) {
  const actor = await requireAdminPermission("jobs:manage");
  const publicKeyPem = process.env.NIGHTLY_OTA_PUBLIC_KEY;
  if (!publicKeyPem) throw new Error("Trusted update signing key is not configured.");
  const ids = form.getAll("deviceId").map(parseId);
  if (ids.length < 1 || ids.length > 5 || new Set(ids).size !== ids.length) throw new Error("Select one to five distinct canary Boxes.");
  const raw = form.get("manifest");
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 2048) throw new Error("Signed manifest is invalid.");
  let manifest: SignedUpdateManifest;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => !["version", "sha256", "downloadUrl", "notBefore", "expiresAt", "hardwareModels", "signature"].includes(key))) throw new Error("Invalid manifest fields");
    manifest = parsed as SignedUpdateManifest;
  } catch { throw new Error("Signed manifest is invalid."); }
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 3, sustainedLimit: 3, windowMs: 60_000, route: "admin:fleet:canary" }).allowed) throw new Error("Too many rollout requests.");
  await scheduleSignedFleetCanary({ deviceIds: ids, manifest, publicKeyPem, actorClerkUserId: actor.clerkUserId });
  revalidatePath("/admin/fleet");
}

export async function pruneFleetHistory(form: FormData) {
  const actor = await requireAdminPermission("jobs:manage");
  const entries = form.getAll("deviceId");
  if (!entries.length || entries.length > 100) throw new Error("A bounded Box selection is required.");
  const ids = entries.map(parseId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate Box selection.");
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 2, sustainedLimit: 2, windowMs: 60_000, route: "admin:fleet:prune" }).allowed) throw new Error("Too many retention runs.");
  const deleted = await pruneFleetHistoryForDevices(ids);
  await db.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "fleet", entityId: "retention", action: "fleet_history_pruned", metadataJson: JSON.stringify({ deviceCount: ids.length, ...deleted }) });
  revalidatePath("/admin/fleet");
}

export async function cancelFleetCanary(form: FormData) {
  const actor = await requireAdminPermission("jobs:manage");
  const rolloutId = parseId(form.get("rolloutId"));
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 5, sustainedLimit: 5, windowMs: 60_000, route: "admin:fleet:cancel-canary" }).allowed) throw new Error("Too many rollout updates.");
  await db.transaction(async (tx) => {
    const [rollout] = await tx.select({ id: fleetUpdateRollouts.id, state: fleetUpdateRollouts.state }).from(fleetUpdateRollouts)
      .where(eq(fleetUpdateRollouts.id, rolloutId)).for("update").limit(1);
    if (!rollout) throw new Error("Rollout unavailable.");
    if (rollout.state === "cancelled") return;
    if (rollout.state !== "scheduled") throw new Error("Only scheduled canaries can be cancelled.");
    const targets = await tx.select({ state: fleetUpdateTargets.state }).from(fleetUpdateTargets).where(eq(fleetUpdateTargets.rolloutId, rolloutId)).for("update");
    if (!targets.length || targets.some((target) => target.state !== "scheduled")) throw new Error("Canary rollout has already advanced.");
    await tx.update(fleetUpdateTargets).set({ state: "cancelled", updatedAt: new Date() }).where(and(eq(fleetUpdateTargets.rolloutId, rolloutId), eq(fleetUpdateTargets.state, "scheduled")));
    await tx.update(fleetUpdateRollouts).set({ state: "cancelled" }).where(eq(fleetUpdateRollouts.id, rolloutId));
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "fleet_rollout", entityId: String(rolloutId), action: "fleet_canary_cancelled", metadataJson: JSON.stringify({ targetCount: targets.length }) });
  });
  revalidatePath("/admin/fleet");
}