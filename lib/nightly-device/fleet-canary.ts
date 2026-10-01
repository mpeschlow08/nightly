import { and, eq, inArray } from "drizzle-orm";

import type { SignedUpdateManifest } from "../../agent/src/core/ota";
import { auditLogs, fleetUpdateRollouts, fleetUpdateTargets, nightlyDevices } from "@/db/schema";
import { canUseDeviceForManagement } from "./policy";
import { canAdvanceFleetUpdate, evaluateFleetUpdateCandidate, type FleetUpdateState } from "./fleet-updates";

export async function scheduleSignedFleetCanary(input: {
  deviceIds: number[];
  manifest: SignedUpdateManifest;
  publicKeyPem: string;
  actorClerkUserId: string;
}): Promise<{ rolloutId: number; duplicate: boolean }> {
  const { deviceIds: ids, manifest, publicKeyPem, actorClerkUserId } = input;
  if (ids.length < 1 || ids.length > 5 || new Set(ids).size !== ids.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    !actorClerkUserId || actorClerkUserId.length > 128 || !publicKeyPem || Buffer.byteLength(JSON.stringify(manifest)) > 2048) throw new Error("Invalid canary request.");
  const { db } = await import("@/db");
  return db.transaction(async (tx) => {
    const devices = await tx.select({ id: nightlyDevices.id, hardwareModel: nightlyDevices.hardwareModel, agentVersion: nightlyDevices.agentVersion, lifecycleState: nightlyDevices.lifecycleState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel })
      .from(nightlyDevices).where(inArray(nightlyDevices.id, ids)).orderBy(nightlyDevices.id).for("update");
    if (devices.length !== ids.length) throw new Error("Canary Box unavailable.");
    const now = new Date();
    for (const device of devices) {
      if (!canUseDeviceForManagement(device) || device.lifecycleState !== "active" || !evaluateFleetUpdateCandidate({ manifest, publicKeyPem, hardwareModel: device.hardwareModel, installedVersion: device.agentVersion }, now).eligible) throw new Error("Canary Box is incompatible or manifest is untrusted.");
    }
    const active = await tx.select({ rolloutId: fleetUpdateTargets.rolloutId, deviceId: fleetUpdateTargets.deviceId }).from(fleetUpdateTargets)
      .where(and(inArray(fleetUpdateTargets.deviceId, ids), inArray(fleetUpdateTargets.state, ["scheduled", "downloading", "verifying", "installing", "restarting", "health_check"])));
    if (active.length) {
      const [existing] = await tx.select({ manifestJson: fleetUpdateRollouts.manifestJson, createdByClerkUserId: fleetUpdateRollouts.createdByClerkUserId }).from(fleetUpdateRollouts)
        .where(eq(fleetUpdateRollouts.id, active[0].rolloutId)).limit(1);
      if (active.length === ids.length && active.every((target) => target.rolloutId === active[0].rolloutId) &&
        existing?.manifestJson === JSON.stringify(manifest) && existing.createdByClerkUserId === actorClerkUserId) return { rolloutId: active[0].rolloutId, duplicate: true };
      throw new Error("One or more canary Boxes already have an active rollout.");
    }
    const [rollout] = await tx.insert(fleetUpdateRollouts).values({ targetVersion: manifest.version, manifestJson: JSON.stringify(manifest), state: "scheduled", createdByClerkUserId: actorClerkUserId }).returning({ id: fleetUpdateRollouts.id });
    await tx.insert(fleetUpdateTargets).values(ids.map((deviceId) => ({ rolloutId: rollout.id, deviceId, state: "scheduled" as const })));
    await tx.insert(auditLogs).values({ actorClerkUserId, actorRole: "admin", entityType: "fleet_rollout", entityId: String(rollout.id), action: "fleet_canary_scheduled", metadataJson: JSON.stringify({ targetCount: ids.length, version: manifest.version }) });
    return { rolloutId: rollout.id, duplicate: false };
  });
}

export async function advanceFleetUpdateTarget(input: {
  targetId: number;
  deviceId: number;
  expectedState: FleetUpdateState;
  nextState: FleetUpdateState;
  manifestVerified: boolean;
  postUpdateHealthVerified: boolean;
  rollbackVerified: boolean;
  failureCode?: string | null;
}): Promise<{ state: FleetUpdateState; duplicate: boolean }> {
  if (!Number.isSafeInteger(input.targetId) || input.targetId < 1 || !Number.isSafeInteger(input.deviceId) || input.deviceId < 1 ||
    input.failureCode && !/^[a-z0-9_]{1,64}$/.test(input.failureCode)) throw new Error("Invalid update transition.");
  const { db } = await import("@/db");
  return db.transaction(async (tx) => {
    const [target] = await tx.select({ id: fleetUpdateTargets.id, rolloutId: fleetUpdateTargets.rolloutId, state: fleetUpdateTargets.state, failureCode: fleetUpdateTargets.failureCode })
      .from(fleetUpdateTargets).where(and(eq(fleetUpdateTargets.id, input.targetId), eq(fleetUpdateTargets.deviceId, input.deviceId))).for("update").limit(1);
    if (!target) throw new Error("Update target unavailable.");
    const failureCode = input.failureCode === undefined ? target.failureCode : input.failureCode;
    if (target.state === input.nextState && target.failureCode === failureCode) return { state: target.state, duplicate: true };
    if (target.state !== input.expectedState) throw new Error("Stale update result.");
    if (!canAdvanceFleetUpdate({ current: target.state, next: input.nextState, manifestVerified: input.manifestVerified,
      postUpdateHealthVerified: input.postUpdateHealthVerified, rollbackVerified: input.rollbackVerified })) throw new Error("Unverified update transition.");
    await tx.update(fleetUpdateTargets).set({ state: input.nextState, failureCode, updatedAt: new Date() })
      .where(and(eq(fleetUpdateTargets.id, input.targetId), eq(fleetUpdateTargets.deviceId, input.deviceId), eq(fleetUpdateTargets.state, input.expectedState)));
    await tx.insert(auditLogs).values({ actorClerkUserId: "fleet-update-controller", actorRole: "service", entityType: "fleet_update_target", entityId: String(target.id), action: "fleet_update_state_changed", metadataJson: JSON.stringify({ rolloutId: target.rolloutId, from: target.state, to: input.nextState, failureCode }) });
    return { state: input.nextState, duplicate: false };
  });
}