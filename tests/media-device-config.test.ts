import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canResolveDeviceMediaCredential, projectDeviceMediaBindings, projectDeviceMediaConfig, type MediaBindingRow } from "../lib/nightly-device/media-bindings";
import { canUseDeviceForOperationalManagement, canUseDeviceForService } from "../lib/nightly-device/policy";

const camera: MediaBindingRow = {
  id: 14, deviceId: 2, venueId: 3, sourceType: "ip_camera", venueCameraId: 4,
  enabled: true, cameraVenueId: 3, cameraStatus: "enabled", cameraStreamType: "rtsp",
};

test("media projection only includes canonical, enabled, venue-scoped bindings", () => {
  const rows = [{ ...camera, id: 20, sourceType: "hdmi_input", venueCameraId: null }, camera, { ...camera, id: 15, deviceId: 9 }, { ...camera, id: 16, cameraVenueId: 8 },
    { ...camera, id: 17, cameraStatus: "disabled" }, { ...camera, id: 18, enabled: false },
    { ...camera, id: 19, sourceType: "other" }];
  assert.deepEqual(projectDeviceMediaBindings(rows, 2, 3), [
    { sourceId: 14, deviceId: 2, venueId: 3, sourceType: "ip_camera", venueCameraId: 4, enabled: true, capability: "rtsp" },
    { sourceId: 20, deviceId: 2, venueId: 3, sourceType: "hdmi_input", venueCameraId: null, enabled: true, capability: "not_tested" },
  ]);
  assert.deepEqual(projectDeviceMediaBindings(rows, 2, null), []);
  assert.doesNotMatch(JSON.stringify(projectDeviceMediaBindings(rows, 2, 3)), /streamUrl|password|rtsp:\/\//i);
});

test("media config has bounded revision and TTL and never serializes stored credentials", () => {
  const rows = [{ ...camera, streamUrl: "rtsp://user:secret@camera.local/live", metadataJson: '{"password":"secret"}' }];
  const config = projectDeviceMediaConfig(rows, 2, 3, "revision-2");
  assert.deepEqual(config, {
    revision: "revision-2", ttlSeconds: 300,
    sources: [{ sourceId: 14, deviceId: 2, venueId: 3, sourceType: "ip_camera", venueCameraId: 4, enabled: true, capability: "rtsp" }],
  });
  assert.doesNotMatch(JSON.stringify(config), /secret|streamUrl|metadataJson|rtsp:\/\//i);
  assert.deepEqual(projectDeviceMediaConfig(rows, 2, 3, "x".repeat(129)).sources, []);
  assert.deepEqual(projectDeviceMediaConfig(rows, 2, 3, null).sources, []);
});

test("credential policy rejects wrong bindings, stale revisions and non-RTSP URLs", () => {
  const input = { source: camera, deviceId: 2, venueId: 3, expectedRevision: "revision-2", desiredConfigRevision: "revision-2", streamUrl: "rtsp://user:secret@camera.local/live" };
  assert.equal(canResolveDeviceMediaCredential(input), true);
  assert.equal(canResolveDeviceMediaCredential({ ...input, deviceId: 9 }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, venueId: 8 }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, source: { ...camera, enabled: false } }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, source: { ...camera, cameraVenueId: 8 } }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, source: { ...camera, cameraStatus: "disabled" } }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, expectedRevision: "revision-1" }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, desiredConfigRevision: null }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, streamUrl: "https://camera.local/live" }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, streamUrl: "rtsp://" }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, streamUrl: "rtsp://camera.local/live?token=secret" }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, streamUrl: "rtsp://user:secret@camera.local/token" }), false);
  assert.equal(canResolveDeviceMediaCredential({ ...input, streamUrl: "rtsps://user:secret@camera.local/live" }), false);
});

test("credential access requires active service and operational management", () => {
  const state = {
    lifecycleState: "active", claimState: "claimed", serviceEntitlementState: "active",
    serviceSuspendedAt: null, managementRecoveryEligible: true, managementAccessLevel: "owner_assisted",
  };
  assert.equal(canUseDeviceForService(state) && canUseDeviceForOperationalManagement(state), true);
  assert.equal(canUseDeviceForService({ ...state, serviceSuspendedAt: new Date() }), false);
  assert.equal(canUseDeviceForService({ ...state, claimState: "unclaimed" }), false);
  assert.equal(canUseDeviceForOperationalManagement({ ...state, lifecycleState: "revoked" }), false);
  assert.equal(canUseDeviceForOperationalManagement({ ...state, managementRecoveryEligible: false }), false);
  assert.equal(canUseDeviceForOperationalManagement({ ...state, managementAccessLevel: "recovery_only" }), false);
});

test("media credential route denies immediately suspended devices before resolving camera credentials", async () => {
  const route = await readFile("app/api/device/v1/media-credentials/route.ts", "utf8");
  assert.match(route, /serviceEntitlementState: nightlyDevices\.serviceEntitlementState/);
  assert.match(route, /serviceSuspendedAt: nightlyDevices\.serviceSuspendedAt/);
  assert.match(route, /device\.serviceEntitlementState !== "active"/);
  assert.match(route, /device\.serviceSuspendedAt !== null/);
});