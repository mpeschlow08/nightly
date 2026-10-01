import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  DeviceCapabilityCategory,
  assertNotSecretPayload,
  buildDeviceAccessError,
  validateClaimCode,
  validateDeviceCapabilityBundle,
} from "../lib/nightly-device/foundation";
import {
  COMMISSIONING_CHECKS,
  NIGHTLY_DEVICE_DEFAULTS,
  canAccessVenueDevice,
  canBindUnassignedDevice,
  canUseDeviceForManagement,
  canUseDeviceForOperationalManagement,
  canUseDeviceForService,
  evaluateFleetState,
  isCaptureSourceType,
  isDeviceClaimUsable,
  normalizeCommissioningStatus,
} from "../lib/nightly-device/policy";
import { classifyNightlyDeviceInventoryWriteError, extractPostgresErrorMetadata, isPostgresUniqueConstraintViolation } from "../lib/nightly-device/database-errors";
import { parseFleetTelemetry, readBoundedJson } from "../lib/nightly-device/telemetry";
import { fleetAlertConditions } from "../lib/nightly-device/fleet-alerts";
import { fleetOperationScope, supportGrantAllowsOperation } from "../lib/nightly-device/fleet-operations";
import { buildFleetSupportBundle } from "../lib/nightly-device/support-bundle";
import { evaluateCommissioning } from "../lib/nightly-device/commissioning";
import { canAdvanceFleetUpdate, evaluateFleetUpdateCandidate } from "../lib/nightly-device/fleet-updates";
import { classifyHealthCheckResult } from "../lib/nightly-device/operation-result";
import { authorizedFleetSweep } from "../lib/nightly-device/fleet-sweep-auth";

const CAMERA_UNIQUE_CONSTRAINT = "nightly_device_sources_venue_camera_unique";

test("fleet scheduler credential authorizes only a configured scoped token", () => {
  const configured = "fleet_scheduler_only_".padEnd(48, "x");
  assert.equal(authorizedFleetSweep(`Bearer ${configured}`, configured), true);
  assert.equal(authorizedFleetSweep(null, configured), false);
  assert.equal(authorizedFleetSweep(`Bearer ${configured}`, undefined), false);
  assert.equal(authorizedFleetSweep(`Bearer ${configured}`, "short"), false);
  assert.equal(authorizedFleetSweep(`Bearer ${configured}wrong`, configured), false);
  assert.equal(authorizedFleetSweep(`Basic ${configured}`, configured), false);
});

test("fleet update targeting requires a signed newer version for the actual hardware model", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const now = new Date("2026-09-30T12:00:00Z");
  const manifest = { version: "1.2.3", sha256: "a".repeat(64), downloadUrl: "https://updates.example.test/agent.tar", notBefore: "2026-09-30T11:00:00.000Z", expiresAt: "2026-09-30T13:00:00.000Z", hardwareModels: ["nightly-box-v1"] };
  const signature = sign(null, Buffer.from(JSON.stringify(manifest)), privateKey).toString("base64");
  const input = { manifest: { ...manifest, signature }, publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(), hardwareModel: "nightly-box-v1", installedVersion: "1.0.0" };
  assert.equal(evaluateFleetUpdateCandidate(input, now).eligible, true);
  assert.equal(evaluateFleetUpdateCandidate({ ...input, hardwareModel: "nightly-box-v2" }, now).eligible, false);
  assert.equal(evaluateFleetUpdateCandidate({ ...input, installedVersion: "1.2.3" }, now).eligible, false);
  assert.equal(evaluateFleetUpdateCandidate({ ...input, installedVersion: "1.2.4" }, now).eligible, false);
  assert.equal(evaluateFleetUpdateCandidate({ ...input, manifest: { ...input.manifest, hardwareModels: ["nightly-box-v2"] } }, now).eligible, false);
});

test("operation results reject expiry and stale terminal overwrites while allowing exact replay", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const base = { state: "pending", resultCode: null, expiresAt: new Date(now.getTime() + 30_000), grantExpiresAt: new Date(now.getTime() + 60_000), grantRevokedAt: null };
  assert.equal(classifyHealthCheckResult(base, "health_ok", now), "complete");
  assert.equal(classifyHealthCheckResult({ ...base, state: "succeeded", resultCode: "health_ok" }, "health_ok", now), "duplicate");
  assert.equal(classifyHealthCheckResult({ ...base, state: "succeeded", resultCode: "health_ok" }, "health_degraded", now), "conflict");
  assert.equal(classifyHealthCheckResult({ ...base, state: "failed" }, "health_ok", now), "expired");
  assert.equal(classifyHealthCheckResult({ ...base, grantRevokedAt: now }, "health_ok", now), "expired");
  assert.equal(classifyHealthCheckResult(base, "health_ok", base.expiresAt), "expired");
  assert.equal(classifyHealthCheckResult({ ...base, grantExpiresAt: now }, "health_ok", now), "expired");
});

test("OTA lifecycle refuses skipped stages, unsigned installs and unverified rollback", () => {
  const candidate = { current: "scheduled" as const, next: "downloading" as const, manifestVerified: false, postUpdateHealthVerified: false, rollbackVerified: false };
  assert.equal(canAdvanceFleetUpdate(candidate), true);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, next: "installing" }), false);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, current: "verifying", next: "installing" }), false);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, current: "verifying", next: "installing", manifestVerified: true }), true);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, current: "health_check", next: "succeeded", manifestVerified: true }), false);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, current: "health_check", next: "succeeded", manifestVerified: true, postUpdateHealthVerified: true }), true);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, current: "failed", next: "rolled_back" }), false);
  assert.equal(canAdvanceFleetUpdate({ ...candidate, current: "failed", next: "rolled_back", rollbackVerified: true }), true);
});

test("commissioning resumes recorded steps but requires real capture and rolling evidence for READY", () => {
  const base = {
    publicDeviceUuid: "box-1", serialNumber: "s-1", enrolled: true, venueId: 12, online: true,
    commercialState: "active", agentVersion: "1.0.0", desiredConfigRevision: "rev-1", appliedConfigRevision: "rev-1",
    sources: [{ sourceType: "ip_camera", enabled: true }, { sourceType: "mixer_audio", enabled: true }],
    checks: ["internet", "nightly_cloud", "cameras", "hardware_acceleration", "audio", "storage"].map((key) => ({ checkKey: key as "internet" | "nightly_cloud" | "cameras" | "hardware_acceleration" | "audio" | "storage", status: "pass" as const, evidenceJson: "{}" })),
  };
  const pending = evaluateCommissioning(base);
  assert.equal(pending.ready, false);
  assert.equal(pending.steps.find((step) => step.key === "capture_test")?.status, "pending");
  assert.equal(pending.steps.find((step) => step.key === "ambient_audio")?.status, "skipped");
  const verified = evaluateCommissioning({ ...base, checks: base.checks.map((check) => ({ ...check, evidenceJson: check.checkKey === "cameras" ? '{"captureValidated":true}' : check.checkKey === "storage" ? '{"rollingBufferReady":true}' : "{}" })) });
  assert.equal(verified.ready, true);
  assert.equal(evaluateCommissioning({ ...base, online: false, checks: verified.steps.length ? base.checks : [] }).ready, false);
});

test("support bundle allows only bounded operational fields and drops unsafe diagnostics", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const bundle = JSON.parse(buildFleetSupportBundle({
    deviceId: 1, agentVersion: "token=leaked", softwareVersion: "1.0", lastHeartbeatAt: now,
    telemetry: null,
    checks: [{ key: "storage", status: "pass", evidence: "camera-password" } as { key: string; status: string }],
    alerts: [{ code: "DEVICE_OFFLINE", severity: "critical", state: "open", secret: "camera-password" } as { code: string; severity: string; state: string }],
    operations: [{ type: "REQUEST_HEALTH_CHECK", state: "succeeded", resultCode: "token=leaked" }],
  }, now));
  assert.equal(bundle.expiresAt, "2026-09-30T12:15:00.000Z");
  assert.equal(bundle.operations[0].resultCode, null);
  assert.equal(bundle.agentVersion, null);
  assert.equal(JSON.stringify(bundle).includes("camera-password"), false);
  assert.equal(JSON.stringify(bundle).includes("token=leaked"), false);
});

test("support operations require exact scoped, live, actor- and device-bound grants", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const grant = { actorClerkUserId: "staff-1", deviceId: 17, scope: "device.request_health_check", expiresAt: new Date(now.getTime() + 60_000), revokedAt: null };
  assert.equal(fleetOperationScope("REQUEST_HEALTH_CHECK"), grant.scope);
  assert.equal(fleetOperationScope("sh -c env"), null);
  assert.equal(supportGrantAllowsOperation(grant, "staff-1", 17, "REQUEST_HEALTH_CHECK", now), true);
  assert.equal(supportGrantAllowsOperation(grant, "staff-2", 17, "REQUEST_HEALTH_CHECK", now), false);
  assert.equal(supportGrantAllowsOperation(grant, "staff-1", 18, "REQUEST_HEALTH_CHECK", now), false);
  assert.equal(supportGrantAllowsOperation(grant, "staff-1", 17, "RESTART_AGENT", now), false);
  assert.equal(supportGrantAllowsOperation(grant, "staff-1", 17, "REQUEST_HEALTH_CHECK", grant.expiresAt), false);
  assert.equal(supportGrantAllowsOperation({ ...grant, revokedAt: now }, "staff-1", 17, "REQUEST_HEALTH_CHECK", now), false);
});

test("fleet alerts distinguish outage, memory pressure and commercial suspension", () => {
  const telemetry = { schemaVersion: 1 as const, uptimeSeconds: 60, memoryTotalBytes: 1000, memoryAvailableBytes: 40, appliedConfigRevision: null };
  assert.deepEqual(fleetAlertConditions({ connectivity: "online", commercialState: "active", telemetry }), [{ code: "MEMORY_PRESSURE", severity: "critical" }]);
  assert.deepEqual(fleetAlertConditions({ connectivity: "offline", commercialState: "suspended", telemetry }), [
    { code: "DEVICE_OFFLINE", severity: "critical" }, { code: "COMMERCIAL_SUSPENSION", severity: "info" },
  ]);
  assert.deepEqual(fleetAlertConditions({ connectivity: "unknown", commercialState: "active", telemetry: null }), []);
  assert.deepEqual(fleetAlertConditions({ connectivity: "online", commercialState: "active", telemetry: { ...telemetry, memoryAvailableBytes: 500, storageTotalBytes: 1000, storageFreeBytes: 30, cameraCount: 2, healthyCameraCount: 0, uploadQueueDepth: 50 } }), [
    { code: "STORAGE_CRITICAL", severity: "critical" }, { code: "ALL_CAPTURE_SOURCES_UNAVAILABLE", severity: "critical" }, { code: "UPLOAD_BACKLOG", severity: "warning" },
  ]);
});

test("fleet heartbeat accepts only bounded versioned allowlisted telemetry", async () => {
  const valid = { schemaVersion: 1, uptimeSeconds: 600, memoryTotalBytes: 4096, memoryAvailableBytes: 1024, appliedConfigRevision: "rev-2" };
  assert.deepEqual(parseFleetTelemetry(valid), valid);
  assert.equal(parseFleetTelemetry({ ...valid, deviceSecret: "secret" }), null);
  assert.equal(parseFleetTelemetry({ ...valid, memoryAvailableBytes: 4097 }), null);
  assert.equal(parseFleetTelemetry({ ...valid, uptimeSeconds: -1 }), null);
  assert.equal(parseFleetTelemetry({ ...valid, schemaVersion: 2 }), null);
  assert.deepEqual(parseFleetTelemetry({ ...valid, storageTotalBytes: 1000, storageFreeBytes: 200, cameraCount: 3, healthyCameraCount: 2 }), { ...valid, storageTotalBytes: 1000, storageFreeBytes: 200, cameraCount: 3, healthyCameraCount: 2 });
  assert.equal(parseFleetTelemetry({ ...valid, storageFreeBytes: 1 }), null);
  assert.equal(parseFleetTelemetry({ ...valid, cameraCount: 2, healthyCameraCount: 3 }), null);
  assert.equal(parseFleetTelemetry({ ...valid, uploadQueueDepth: 100_001 }), null);
  assert.deepEqual(await readBoundedJson(new Request("https://nightly.test", { method: "POST", body: JSON.stringify(valid) })), valid);
  await assert.rejects(readBoundedJson(new Request("https://nightly.test", { method: "POST", body: "x".repeat(4097) })), /oversized_body/);
});

test("fleet state derives freshness independently of commercial suspension", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const device = { lifecycleState: "active", claimState: "claimed", operationalState: "healthy", serviceEntitlementState: "active" };
  assert.deepEqual(evaluateFleetState({ ...device, lastHeartbeatAt: new Date(now - 30_000) }, now), {
    state: "ready", health: "healthy", connectivity: "online", commercialState: "active",
  });
  assert.deepEqual(evaluateFleetState({ ...device, lastHeartbeatAt: new Date(now - 3 * 60_000) }, now), {
    state: "degraded", health: "degraded", connectivity: "stale", commercialState: "active",
  });
  assert.deepEqual(evaluateFleetState({ ...device, lastHeartbeatAt: new Date(now - 6 * 60_000) }, now), {
    state: "offline", health: "offline", connectivity: "offline", commercialState: "active",
  });
  assert.deepEqual(evaluateFleetState({ ...device, serviceEntitlementState: "suspended", lastHeartbeatAt: new Date(now - 30_000) }, now), {
    state: "suspended", health: "healthy", connectivity: "online", commercialState: "suspended",
  });
  assert.deepEqual(evaluateFleetState({ ...device, operationalState: "suspended", serviceEntitlementState: "suspended", lastHeartbeatAt: new Date(now - 30_000) }, now), {
    state: "suspended", health: "unknown", connectivity: "online", commercialState: "suspended",
  });
  assert.equal(evaluateFleetState({ ...device, claimState: "unclaimed", lastHeartbeatAt: null }, now).state, "provisioning");
  assert.equal(evaluateFleetState({ ...device, commissioningReady: false, lastHeartbeatAt: new Date(now) }, now).state, "commissioning");
  assert.equal(evaluateFleetState({ ...device, commissioningReady: false, lastHeartbeatAt: new Date(now - 6 * 60_000) }, now).state, "offline");
  assert.deepEqual(evaluateFleetState({ ...device, lastHeartbeatAt: null }, now), {
    state: "commissioning", health: "unknown", connectivity: "unknown", commercialState: "active",
  });
});

test("device config projects server commercial entitlement as ineligible for capture", () => {
  const route = readFileSync(join(process.cwd(), "app/api/device/v1/config/route.ts"), "utf8");
  assert.match(route, /getDeviceCommercialDirective\(device\.id\)/);
  assert.match(route, /commercialCapabilities\.has\("device\.capture"\)/);
  assert.match(route, /commercial,/);
});

test("device capability bundles accept supported Nightly Box capabilities", () => {
  const capabilities = [
    { category: DeviceCapabilityCategory.HDMI_INPUT, name: "1080p60", value: "supported", supported: true },
    { category: DeviceCapabilityCategory.ETHERNET, name: "lan_count", value: 2, supported: true },
    { category: DeviceCapabilityCategory.SECURE_BOOT, name: "enabled", value: true, supported: true },
  ];

  assert.doesNotThrow(() => validateDeviceCapabilityBundle(capabilities));
});

test("device capability bundles reject secret-bearing metadata", () => {
  const capabilities = [
    {
      category: DeviceCapabilityCategory.WIFI,
      name: "ssid",
      value: "Nightly-Secret-SSID",
      supported: true,
    },
  ];

  assert.throws(() => validateDeviceCapabilityBundle(capabilities), /secret|credential|token/i);
});

test("claim codes reject expired or already-used values", () => {
  const expiredCode = {
    code: "nightly-claim-1",
    expiresAt: new Date(Date.now() - 60_000),
    usedAt: null,
    revokedAt: null,
  };

  const usedCode = {
    code: "nightly-claim-2",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: new Date(),
    revokedAt: null,
  };

  assert.throws(() => validateClaimCode(expiredCode), /expired/i);
  assert.throws(() => validateClaimCode(usedCode), /already used|replay/i);
});

test("valid pending claim is usable and can bind an unassigned device", () => {
  const now = Date.UTC(2026, 8, 27);
  assert.equal(isDeviceClaimUsable({ status: "pending", expiresAt: new Date(now + 1000), usedAt: null, revokedAt: null }, now), true);
  assert.equal(canBindUnassignedDevice({ venueId: null, claimState: "unclaimed", lifecycleState: "inventory" }), true);
});

test("expired, revoked, consumed, and non-pending claims fail closed", () => {
  const now = Date.UTC(2026, 8, 27);
  assert.equal(isDeviceClaimUsable({ status: "pending", expiresAt: new Date(now), usedAt: null, revokedAt: null }, now), false);
  assert.equal(isDeviceClaimUsable({ status: "revoked", expiresAt: null, usedAt: null, revokedAt: new Date(now) }, now), false);
  assert.equal(isDeviceClaimUsable({ status: "claimed", expiresAt: null, usedAt: new Date(now), revokedAt: null }, now), false);
  assert.equal(isDeviceClaimUsable({ status: "expired", expiresAt: null, usedAt: null, revokedAt: null }, now), false);
});

test("a consumed claim and bound device cannot be claimed a second time", () => {
  const now = Date.UTC(2026, 8, 27);
  const claim = { status: "pending", expiresAt: new Date(now + 1000), usedAt: null as Date | null, revokedAt: null as Date | null };
  const device = { venueId: null as number | null, claimState: "unclaimed", lifecycleState: "inventory" };
  assert.equal(isDeviceClaimUsable(claim, now) && canBindUnassignedDevice(device), true);
  claim.status = "claimed";
  claim.usedAt = new Date(now);
  device.venueId = 17;
  device.claimState = "claimed";
  assert.equal(isDeviceClaimUsable(claim, now) && canBindUnassignedDevice(device), false);
});

test("claim redemption serializes concurrent requests and conditionally consumes once", () => {
  const route = readFileSync(join(process.cwd(), "app/api/device/v1/claim/route.ts"), "utf8");
  assert.equal((route.match(/\.for\("update"\)/g) ?? []).length, 2);
  assert.match(route, /eq\(nightlyDeviceClaims\.status, "pending"\)/);
  assert.match(route, /isNull\(nightlyDeviceClaims\.usedAt\)/);
  assert.match(route, /throw new ClaimBindingConflict\(\)/);
  assert.equal(route.includes("code: body.claimCode"), false);
});

test("unrelated actors cannot view or manage a venue device", () => {
  const actor = { role: "unrelated" as const, venueId: null };
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "view" }), false);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "operate" }), false);
});

test("owner can manage only a device assigned to the owner's venue", () => {
  const actor = { role: "owner" as const, venueId: 17 };
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "view" }), true);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "lifecycle" }), true);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 18, action: "operate" }), false);
});

test("delegated Tech Operator gets operational access but not lifecycle authority", () => {
  const actor = { role: "tech_operator" as const, venueId: 17 };
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "view" }), true);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "operate" }), true);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "lifecycle" }), false);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 18, action: "operate" }), false);
});

test("manager is denied owner-only lifecycle operations", () => {
  const actor = { role: "manager" as const, venueId: 17 };
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "operate" }), true);
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "lifecycle" }), false);
});

test("admin authorization can access devices across venues", () => {
  const actor = { role: "admin" as const, venueId: null };
  assert.equal(canAccessVenueDevice({ actor, deviceVenueId: 17, action: "lifecycle" }), true);
});

test("revoked devices cannot use customer service or management recovery", () => {
  assert.equal(canUseDeviceForService({ lifecycleState: "revoked", claimState: "claimed", serviceEntitlementState: "active" }), false);
  assert.equal(canUseDeviceForManagement({ lifecycleState: "revoked", managementRecoveryEligible: true }), false);
});

test("suspended customer entitlement can retain separate Nightly recovery access", () => {
  assert.equal(canUseDeviceForService({ lifecycleState: "active", claimState: "claimed", serviceEntitlementState: "suspended", serviceSuspendedAt: new Date() }), false);
  assert.equal(canUseDeviceForManagement({ lifecycleState: "active", managementRecoveryEligible: true }), true);
});

test("disabled recovery access blocks management even when service is active", () => {
  assert.equal(canUseDeviceForManagement({ lifecycleState: "active", managementRecoveryEligible: false }), false);
  assert.equal(canUseDeviceForService({ lifecycleState: "active", claimState: "claimed", serviceEntitlementState: "active" }), true);
});

test("recovery-only management cannot retrieve config or report operational capabilities", () => {
  const recoveryOnly = { lifecycleState: "active", managementRecoveryEligible: true, managementAccessLevel: "recovery_only" };
  assert.equal(canUseDeviceForManagement(recoveryOnly), true);
  assert.equal(canUseDeviceForOperationalManagement(recoveryOnly), false);
});

test("disabled management access blocks both recovery and operational API access", () => {
  const disabled = { lifecycleState: "active", managementRecoveryEligible: true, managementAccessLevel: "disabled" };
  assert.equal(canUseDeviceForManagement(disabled), false);
  assert.equal(canUseDeviceForOperationalManagement(disabled), false);
});

test("claimed but not activated devices cannot use customer service", () => {
  assert.equal(canUseDeviceForService({ lifecycleState: "claimed", claimState: "claimed", serviceEntitlementState: "active" }), false);
});

test("privacy and publishing defaults are conservative", () => {
  assert.deepEqual(NIGHTLY_DEVICE_DEFAULTS, {
    serviceEntitlementState: "inactive",
    privacyMode: "private",
    contentEligibility: "restricted",
    publicPublishingEnabled: false,
    hotReelEligible: false,
    liveEligible: false,
    privacyConfigRevision: 1,
  });
});

test("capture model accepts current source types and leaves room for other sources", () => {
  for (const source of ["ip_camera", "hdmi_input", "mixer_audio", "ambient_audio", "other"]) {
    assert.equal(isCaptureSourceType(source), true);
  }
  assert.equal(isCaptureSourceType("rtsp_credential"), false);
});

test("commissioning checks default to not tested until evidence is recorded", () => {
  assert.deepEqual(COMMISSIONING_CHECKS, ["cameras", "audio", "hdmi", "hardware_acceleration", "storage", "internet", "nightly_cloud"]);
  assert.equal(normalizeCommissioningStatus(undefined), "not_tested");
  assert.equal(normalizeCommissioningStatus("pass"), "pass");
  assert.equal(normalizeCommissioningStatus("success"), "not_tested");
});

test("malformed capability payloads are rejected", () => {
  assert.throws(() => validateDeviceCapabilityBundle(null as never), /must be an array/i);
  assert.throws(() => validateDeviceCapabilityBundle([null] as never), /must be an object/i);
  assert.throws(() => validateDeviceCapabilityBundle([{ category: "hdmi_input", name: "mode", value: {}, supported: true }] as never), /scalar/i);
  assert.throws(() => validateDeviceCapabilityBundle([{ category: "hdmi_input", name: "mode", value: "ok", supported: true, metadata: "bad" }] as never), /metadata/i);
  assert.throws(() => validateDeviceCapabilityBundle([
    { category: "hdmi_input", name: "mode", value: "1080p", supported: true },
    { category: "hdmi_input", name: "mode", value: "4k", supported: true },
  ]), /duplicate/i);
});

test("normalized secret metadata keys are rejected", () => {
  assert.throws(() => assertNotSecretPayload({ apiKey: "opaque" }), /sensitive/i);
  assert.throws(() => assertNotSecretPayload({ access_token: "opaque" }), /sensitive/i);
});

test("safe device error shape does not include credential fields", () => {
  const error = buildDeviceAccessError("unauthorized", "Device authentication is required.");
  assert.deepEqual(error, { error: { code: "unauthorized", message: "Device authentication is required." } });
  assert.equal(JSON.stringify(error).includes("claimCode"), false);
  assert.equal(JSON.stringify(error).includes("deviceSecret"), false);
});

test("PostgreSQL classifier recognizes direct and wrapped canonical-camera unique violations", () => {
  const direct = { name: "error", code: "23505", constraint: CAMERA_UNIQUE_CONSTRAINT };
  assert.equal(isPostgresUniqueConstraintViolation(direct, CAMERA_UNIQUE_CONSTRAINT), true);
  assert.equal(isPostgresUniqueConstraintViolation({ name: "DrizzleQueryError", cause: direct }, CAMERA_UNIQUE_CONSTRAINT), true);
  assert.equal(isPostgresUniqueConstraintViolation({ name: "Outer", cause: { name: "Middle", cause: direct } }, CAMERA_UNIQUE_CONSTRAINT), true);
  assert.deepEqual(extractPostgresErrorMetadata({ name: "DrizzleQueryError", cause: direct }), {
    code: "23505",
    constraint: CAMERA_UNIQUE_CONSTRAINT,
    errorName: "error",
    depth: 1,
  });
});

test("PostgreSQL classifier rejects unrelated, malformed, cyclic, and overdeep errors", () => {
  assert.equal(isPostgresUniqueConstraintViolation({ code: "23505", constraint: "nightly_device_sources_device_type_label_unique" }, CAMERA_UNIQUE_CONSTRAINT), false);
  assert.equal(isPostgresUniqueConstraintViolation({ code: "23503", constraint: CAMERA_UNIQUE_CONSTRAINT }, CAMERA_UNIQUE_CONSTRAINT), false);
  assert.equal(isPostgresUniqueConstraintViolation({ code: 23505, constraint: CAMERA_UNIQUE_CONSTRAINT }, CAMERA_UNIQUE_CONSTRAINT), false);
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(extractPostgresErrorMetadata(cyclic), null);
  let overdeep: unknown = { code: "23505", constraint: CAMERA_UNIQUE_CONSTRAINT };
  for (let depth = 0; depth < 9; depth += 1) overdeep = { cause: overdeep };
  assert.equal(extractPostgresErrorMetadata(overdeep), null);
});

test("canonical camera unique conflict maps to safe 409 and unrelated DB errors stay unclassified", () => {
  const pgError = { code: "23505", constraint: CAMERA_UNIQUE_CONSTRAINT };
  const wrapped = { name: "DrizzleQueryError", cause: { name: "NeonDriverError", cause: pgError } };
  assert.deepEqual(classifyNightlyDeviceInventoryWriteError(wrapped), {
    status: 409,
    code: "source_camera_conflict",
    message: "Venue camera is already assigned to a source.",
  });
  assert.equal(classifyNightlyDeviceInventoryWriteError({ cause: { code: "23505", constraint: "nightly_device_sources_device_type_label_unique" } }), null);
  assert.equal(classifyNightlyDeviceInventoryWriteError({ cause: { code: "23503", constraint: CAMERA_UNIQUE_CONSTRAINT } }), null);
});

test("inventory route preserves venue-owned sources and maps only canonical camera conflicts", () => {
  const route = readFileSync(join(process.cwd(), "app/api/device/v1/inventory/route.ts"), "utf8");
  const schema = readFileSync(join(process.cwd(), "db/schema.ts"), "utf8");
  assert.match(route, /like\(nightlyDeviceSources\.sourceLabel, "agent:%"\)/);
  assert.match(route, /if \(unchanged\) return;/);
  assert.match(route, /desiredConfigRevision: randomUUID\(\)/);
  assert.match(route, /classifyNightlyDeviceInventoryWriteError\(error\)/);
  assert.match(route, /status: conflict\.status/);
  assert.match(schema, /unique\("nightly_device_sources_venue_camera_unique"\)\.on\(table\.venueCameraId\)/);
  assert.match(schema, /nightly_device_sources_camera_venue_fkey/);
});
