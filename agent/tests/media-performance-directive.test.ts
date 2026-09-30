import assert from "node:assert/strict";
import { test } from "node:test";
import type { ControlPlaneConfig, PerformanceSession } from "../src/core/types";
import { DeviceMediaBindings } from "../src/media/device-bindings";
import { PerformanceDirective } from "../src/media/performance-directive";

const publicId = "123e4567-e89b-42d3-a456-426614174000";
const session: PerformanceSession = {
  publicId, deviceId: 7, venueId: 9, sources: [
    { sourceId: 3, role: "camera" }, { sourceId: 4, role: "program_audio" }, { sourceId: 5, role: "ambient_audio" },
  ], startedAt: "2026-01-01T00:00:00.000Z", leaseExpiresAt: "2026-01-01T12:00:00.000Z",
  includeMicrophone: false, mediaRevision: 1,
};
const config: ControlPlaneConfig = {
  ok: true, deviceId: 7, model: "nightly-box", venueId: 9, configRevision: "rev-1", configAvailable: true,
  timestamp: session.startedAt,
  sections: {
    privacy: { mode: "private", contentEligibility: "approved", publicPublishingEnabled: true, revision: 1 },
    service: { entitlementState: "active", hotReelEligible: true, liveEligible: false, revision: 1 },
    commercial: { commercialState: "active", reasonCode: "active_subscription", allowedCapabilities: ["device.capture","device.hot_moments","venue.hot_reels"], revision: 1, subscriptionRevision: 1, issuedAt: session.startedAt, refreshBy: "2026-01-01T00:04:00.000Z", offlineEntitlementExpiresAt: "2026-01-04T00:00:00.000Z", managementAvailable: true },
    media: { revision: "rev-1", ttlSeconds: 300, sources: [
      { sourceId: 3, deviceId: 7, venueId: 9, sourceType: "ip_camera", venueCameraId: 5, enabled: true, capability: "rtsp" },
      { sourceId: 4, deviceId: 7, venueId: 9, sourceType: "mixer_audio", venueCameraId: null, enabled: true, capability: "not_tested" },
      { sourceId: 5, deviceId: 7, venueId: 9, sourceType: "ambient_audio", venueCameraId: null, enabled: true, capability: "not_tested" },
    ] },
    recovery: { enabled: false },
    performance: { revision: "rev-1", ttlSeconds: 300, sessions: [session] },
  },
};

test("resolves only a unique active source and wholly contained candidate window", () => {
  let time = Date.parse(session.startedAt) + 1_000;
  const bindings = new DeviceMediaBindings(undefined, () => time);
  const directive = new PerformanceDirective(() => time);
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  directive.update(config, bindings);
  assert.deepEqual(directive.resolve(3, time - 900, time), { publicId, mediaRevision: 1, includeMicrophone: false });
  assert.equal(directive.resolve(4, time - 900, time), null);
  assert.equal(directive.resolve(5, time - 900, time), null);
  assert.equal(directive.resolve(3, time - 1_001, time), null);
  assert.equal(directive.resolve(3, time - 900, time + 1), null);
  assert.equal(directive.resolve(3, time, time), null);
  const overlapping = { ...config, sections: { ...config.sections, performance: {
    ...config.sections.performance!, sessions: [session, { ...session, publicId: "223e4567-e89b-42d3-a456-426614174000" }],
  } } };
  directive.update(overlapping, bindings);
  assert.equal(directive.resolve(3, time - 900, time), null);
  directive.update({ ...config, sections: { ...config.sections, performance: {
    ...config.sections.performance!, sessions: [{ ...session, includeMicrophone: true }],
  } } }, bindings);
  assert.deepEqual(directive.resolve(3, time - 900, time), { publicId, mediaRevision: 1, includeMicrophone: true });
  time = Date.parse(session.startedAt) + 300_000;
  assert.equal(directive.resolve(3, time - 1_000, time), null);
});

test("rejects malformed or stale sessions and clears the previous directive", () => {
  const time = Date.parse(session.startedAt) + 1_000;
  const bindings = new DeviceMediaBindings(undefined, () => time);
  const directive = new PerformanceDirective(() => time);
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  const invalid: Array<ControlPlaneConfig["sections"]["performance"]> = [
    null as unknown as ControlPlaneConfig["sections"]["performance"],
    { ...config.sections.performance!, revision: "rev-old" },
    { ...config.sections.performance!, revision: null },
    { ...config.sections.performance!, ttlSeconds: 301 },
    { ...config.sections.performance!, sessions: Array(5).fill(session) },
    ...[
      { deviceId: 8 }, { venueId: 10 }, { sources: [{ sourceId: 6, role: "camera" }] },
      { sources: [{ sourceId: 4, role: "camera" }] },
      { sources: [{ sourceId: 3, role: "camera" }, { sourceId: 3, role: "camera" }] },
      { sources: [{ sourceId: 3, role: "ambient_audio" }] },
      { leaseExpiresAt: "2026-01-01T12:00:01.000Z" },
      { publicId: "not-a-uuid" }, { startedAt: "2026-01-01" },
      { startedAt: "2026-01-01T00:00:02.000Z" }, { mediaRevision: 0 }, { includeMicrophone: "yes" },
    ].map((change) => ({ ...config.sections.performance!, sessions: [{ ...session, ...change } as PerformanceSession] })),
  ];
  for (const performance of invalid) {
    directive.update(config, bindings);
    assert.throws(() => directive.update({ ...config, sections: { ...config.sections, performance } }, bindings), /invalid_performance_directive/);
    assert.equal(directive.resolve(3, time - 500, time), null);
  }
});

test("omission, empty sessions, binding revocation, and lease expiry fail closed", () => {
  let time = Date.parse(session.startedAt) + 1_000;
  const bindings = new DeviceMediaBindings(undefined, () => time);
  const directive = new PerformanceDirective(() => time);
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  directive.update(config, bindings);
  directive.update({ ...config, sections: { ...config.sections, performance: undefined } }, bindings);
  assert.equal(directive.resolve(3, time - 500, time), null);
  directive.update(config, bindings);
  directive.update({ ...config, sections: { ...config.sections, performance: { revision: "rev-1", ttlSeconds: 300, sessions: [] } } }, bindings);
  assert.equal(directive.resolve(3, time - 500, time), null);
  directive.update(config, bindings);
  bindings.clear();
  assert.equal(directive.resolve(3, time - 500, time), null);
  bindings.bindIdentity(7, 9);
  bindings.update(config);
  directive.update(config, bindings);
  time += 300_000;
  assert.equal(directive.resolve(3, time - 500, time), null);
  bindings.update(config);
  assert.throws(() => directive.update(config, bindings), /invalid_performance_directive/);
  assert.equal(directive.resolve(3, time - 500, time), null);
  time = Date.parse(session.leaseExpiresAt) + 1;
  const renewed = { ...config, timestamp: new Date(time).toISOString() };
  bindings.update(renewed);
  assert.throws(() => directive.update(renewed, bindings), /invalid_performance_directive/);
  assert.equal(directive.resolve(3, time - 500, time), null);
});