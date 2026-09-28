import assert from "node:assert/strict";
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
  isCaptureSourceType,
  isDeviceClaimUsable,
  normalizeCommissioningStatus,
} from "../lib/nightly-device/policy";
import { classifyNightlyDeviceInventoryWriteError, extractPostgresErrorMetadata, isPostgresUniqueConstraintViolation } from "../lib/nightly-device/database-errors";

const CAMERA_UNIQUE_CONSTRAINT = "nightly_device_sources_venue_camera_unique";

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
  assert.match(route, /classifyNightlyDeviceInventoryWriteError\(error\)/);
  assert.match(route, /status: conflict\.status/);
  assert.match(schema, /unique\("nightly_device_sources_venue_camera_unique"\)\.on\(table\.venueCameraId\)/);
  assert.match(schema, /nightly_device_sources_camera_venue_fkey/);
});
