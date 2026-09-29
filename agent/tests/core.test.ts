import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { AgentStateMachine } from "../src/core/state-machine";
import { FileAgentStateStore } from "../src/core/state-store";
import { EncryptedFileCredentialStore } from "../src/core/credential-store";
import { loadAgentConfig } from "../src/core/config";
import { ControlPlaneClient, ControlPlaneError } from "../src/core/control-plane-client";
import { AgentRuntime } from "../src/core/runtime";
import { DeviceMediaBindings } from "../src/media/device-bindings";
import type { AgentMediaRuntime } from "../src/media/runtime";
import type { AgentStateStore } from "../src/core/state-store";
import type { CredentialStore } from "../src/core/credential-store";
import type { ControlPlaneConfig } from "../src/core/types";
import { SimulationProbeAdapter } from "../src/probes/linux";
import { verifyUpdateManifest } from "../src/core/ota";
import type { AgentConfig, AgentPersistentState } from "../src/core/types";

const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "nightly-agent-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function defaultConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    controlPlaneUrl: "https://control.example.test",
    deviceUuid: "device-uuid",
    serialNumber: "serial-123",
    agentVersion: "0.1.0",
    heartbeatIntervalMs: 30_000,
    requestTimeoutMs: 1_000,
    retryBaseMs: 100,
    retryMaxMs: 1_000,
    stateDirectory: "/var/lib/nightly-agent",
    sourceDiscoveryWindowMs: 3_000,
    simulation: false,
    ...overrides,
  };
}

function defaultState(): AgentPersistentState {
  return {
    schemaVersion: 1,
    agentState: "STARTING",
    deviceId: null,
    publicDeviceUuid: null,
    serialNumber: null,
    softwareVersion: null,
    agentVersion: "0.1.0",
    desiredConfigRevision: null,
    appliedConfigRevision: null,
    policyConfig: null,
    lastCloudContactAt: null,
    lastHeartbeatAt: null,
    lastErrorCode: null,
    simulation: false,
    updatedAt: new Date().toISOString(),
  };
}

test("state machine rejects transitions outside the lifecycle graph", () => {
  const machine = new AgentStateMachine();
  machine.transition("UNPROVISIONED");
  machine.transition("BOOTSTRAPPING");
  machine.transition("AUTHENTICATING");
  assert.throws(() => machine.transition("ONLINE"), /Invalid Agent state transition/);
});

test("state store atomically round-trips bounded state and quarantines corruption", async () => {
  const directory = await temporaryDirectory();
  const store = new FileAgentStateStore(directory);
  await store.save(defaultState());
  assert.equal((await store.load())?.agentVersion, "0.1.0");
  await (await import("node:fs/promises")).writeFile(store.filePath, "{");
  assert.equal(await store.load(), null);
});

test("credential store encrypts at rest and authenticates its envelope", async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, "credential.enc");
  const key = Buffer.alloc(32, 7);
  const store = new EncryptedFileCredentialStore(path, key);
  await store.save({ deviceSecret: "a".repeat(48) });
  const onDisk = await readFile(path, "utf8");
  assert.equal(onDisk.includes("a".repeat(48)), false);
  assert.deepEqual(await store.load(), { deviceSecret: "a".repeat(48) });
  await assert.rejects(new EncryptedFileCredentialStore(path, Buffer.alloc(32, 8)).load(), /could not be authenticated/);
});

test("runtime config requires TLS and refuses production simulation", () => {
  assert.throws(() => loadAgentConfig({ NIGHTLY_CONTROL_PLANE_URL: "http://cp.example.test" }), /must use TLS/);
  assert.throws(() => loadAgentConfig({ NODE_ENV: "production", NIGHTLY_CONTROL_PLANE_URL: "https://cp.example.test", NIGHTLY_AGENT_SIMULATION: "true" }), /not allowed in production/);
  assert.equal(loadAgentConfig({ NIGHTLY_CONTROL_PLANE_URL: "http://localhost:3000" }).controlPlaneUrl, "http://localhost:3000");
});

test("bootstrap persists the one-time secret before returning and never retries", async () => {
  let calls = 0;
  let persisted = false;
  const client = new ControlPlaneClient({
    baseUrl: "https://control.example.test",
    deviceUuid: "device-uuid",
    requestTimeoutMs: 1_000,
    retryBaseMs: 1,
    retryMaxMs: 10,
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ ok: true, device: { id: 3, publicDeviceUuid: "device-uuid", serialNumber: "serial-123", lifecycleState: "provisioned", claimState: "unclaimed" }, deviceSecret: "s".repeat(48) }), { status: 200 });
    },
  });
  const device = await client.bootstrap({ publicDeviceUuid: "device-uuid", serialNumber: "serial-123", bootstrapToken: "b".repeat(48) }, async (secret) => {
    assert.equal(secret, "s".repeat(48));
    persisted = true;
  });
  assert.equal(device.id, 3);
  assert.equal(persisted, true);
  assert.equal(calls, 1);

  const ambiguous = new ControlPlaneClient({
    baseUrl: "https://control.example.test",
    deviceUuid: "device-uuid",
    requestTimeoutMs: 1_000,
    retryBaseMs: 1,
    retryMaxMs: 10,
    fetchImpl: async () => { calls += 1; throw new Error("socket closed after write"); },
  });
  await assert.rejects(ambiguous.bootstrap({ publicDeviceUuid: "device-uuid", serialNumber: "serial-123", bootstrapToken: "b".repeat(48) }, async () => undefined), (error: unknown) => error instanceof ControlPlaneError && error.code === "bootstrap_outcome_unknown");
  assert.equal(calls, 2);
});

test("client retries transient server errors but does not retry authorization denial", async () => {
  let calls = 0;
  const client = new ControlPlaneClient({
    baseUrl: "https://control.example.test",
    deviceUuid: "device-uuid",
    requestTimeoutMs: 1_000,
    retryBaseMs: 1,
    retryMaxMs: 5,
    random: () => 0,
    sleep: async () => undefined,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ error: { code: "temporary", message: "retry" } }), { status: 503 })
        : new Response(JSON.stringify({ ok: true, device: { id: 3, venueId: 8, status: "active", serviceEntitlementState: "active", operationalState: "healthy", timestamp: new Date().toISOString() } }), { status: 200 });
    },
  });
  assert.equal((await client.heartbeat("s".repeat(48), { agentVersion: "0.1.0" })).ok, true);
  assert.equal(calls, 2);

  calls = 0;
  const denied = new ControlPlaneClient({
    baseUrl: "https://control.example.test",
    deviceUuid: "device-uuid",
    requestTimeoutMs: 1_000,
    retryBaseMs: 1,
    retryMaxMs: 5,
    sleep: async () => undefined,
    fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ error: { code: "unauthorized", message: "denied" } }), { status: 401 }); },
  });
  await assert.rejects(denied.heartbeat("s".repeat(48), { agentVersion: "0.1.0" }));
  assert.equal(calls, 1);
});

test("simulation probes never inspect hardware and mark every result SIMULATED", async () => {
  const snapshot = await new SimulationProbeAdapter().discover(defaultConfig({ simulation: true }));
  assert.equal(snapshot.platform, "simulated");
  assert.equal(snapshot.inventory.sources.length, 0);
  assert.ok(snapshot.probes.every((probe) => probe.status === "not_tested" && probe.evidence.marker === "SIMULATED"));
  assert.ok(snapshot.commissioning.checks.every((check) => check.status === "not_tested" && check.evidence.simulated === true));
});

test("OTA verifier accepts only valid signed HTTPS manifests and never installs", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const notBefore = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const base = { version: "1.2.3", sha256: "a".repeat(64), downloadUrl: "https://updates.example.test/agent.tar", notBefore, expiresAt };
  const payload = JSON.stringify({ ...base, sha256: base.sha256, notBefore, expiresAt });
  const signature = sign(null, Buffer.from(payload), privateKey).toString("base64");
  const accepted = verifyUpdateManifest({ ...base, signature }, publicKey.export({ type: "spki", format: "pem" }).toString());
  assert.equal(accepted.eligible, true);
  assert.equal(accepted.reason, "signature_verified_no_install_performed");
  assert.equal(verifyUpdateManifest({ ...base, downloadUrl: "http://updates.example.test/agent.tar", signature }, publicKey.export({ type: "spki", format: "pem" }).toString()).eligible, false);
});

test("healthy recurring cycles recover from offline and degraded states", () => {
  const machine = new AgentStateMachine();
  machine.transition("UNPROVISIONED");
  machine.transition("BOOTSTRAPPING");
  machine.transition("AUTHENTICATING");
  machine.transition("CONNECTING");
  machine.transition("ONLINE");
  machine.transition("CONNECTING");
  machine.transition("ONLINE");
  machine.transition("OFFLINE");
  machine.transition("CONNECTING");
  machine.transition("ONLINE");
  machine.transition("DEGRADED");
  machine.transition("CONNECTING");
  machine.transition("ONLINE");
  assert.equal(machine.state, "ONLINE");
});

test("suspension, recovery-only, revocation recovery, and errors stay constrained", () => {
  const machine = new AgentStateMachine("ONLINE");
  assert.throws(() => machine.transition("BOOTSTRAPPING"), /Invalid Agent state transition/);
  machine.transition("SUSPENDED");
  machine.transition("CONNECTING");
  machine.transition("RECOVERY_ONLY");
  machine.transition("CONNECTING");
  machine.transition("ONLINE");
  machine.transition("RECOVERY_REQUIRED");
  machine.transition("AUTHENTICATING");
  machine.transition("CONNECTING");
  machine.transition("ERROR");
  machine.transition("RECOVERY_REQUIRED");
});

test("media credential POST authenticates the device and never exposes server-provided URL errors", async () => {
  let called = false;
  const client = new ControlPlaneClient({
    baseUrl: "https://control.example.test", deviceUuid: "device-uuid", requestTimeoutMs: 1000, retryBaseMs: 1, retryMaxMs: 1,
    fetchImpl: async (url, init) => {
      called = true;
      assert.match(String(url), /\/media-credentials$/);
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer device-secret");
      assert.deepEqual(JSON.parse(String(init?.body)), { sourceId: 3, expectedRevision: "rev-1" });
      return new Response(JSON.stringify({ error: { code: "source_unavailable", message: "rtsp://user:password@camera.invalid/live" } }), { status: 404 });
    },
  });
  await assert.rejects(client.resolveMediaCredential("device-secret", 3, "rev-1"), (error: unknown) =>
    error instanceof ControlPlaneError && error.code === "media_credential_unavailable" && !error.message.includes("rtsp:"));
  assert.equal(called, true);
});

test("agent keeps media authorization in memory and rejects malformed config before capture", async () => {
  const response: ControlPlaneConfig = {
    ok: true, deviceId: 7, model: "nightly-box", venueId: 9, configRevision: "rev-1", configAvailable: true,
    timestamp: new Date().toISOString(),
    sections: {
      privacy: { mode: "private", contentEligibility: "approved", publicPublishingEnabled: true, revision: 1 },
      service: { entitlementState: "active", hotReelEligible: true, liveEligible: false, revision: 1 },
      media: { revision: "rev-1", ttlSeconds: 300, sources: [{ sourceId: 3, deviceId: 7, venueId: 9, sourceType: "ip_camera", venueCameraId: 5, enabled: true, capability: "rtsp" }] },
      recovery: { enabled: false },
    },
  };
  for (const valid of [true, false]) {
    const stored: string[] = [];
    const events: string[] = [];
    const bindings = new DeviceMediaBindings();
    const media = {
      start: async () => { events.push("start"); },
      reconcile: async () => { events.push("reconcile"); },
      stop: async () => { events.push("stop"); },
    } as unknown as AgentMediaRuntime;
    const store: AgentStateStore = {
      load: async () => ({ ...defaultState(), deviceId: 7 }),
      save: async (state) => { stored.push(JSON.stringify(state)); },
    };
    const client = {
      heartbeat: async () => ({ device: { id: 7, uuid: "device-uuid", venueId: 9, status: "active" } }),
      getStatus: async () => ({ device: { id: 7, uuid: "device-uuid", venueId: 9, managementAccessLevel: "owner_assisted" } }),
      getConfig: async () => valid ? response : { ...response, sections: { ...response.sections, media: { ...response.sections.media, ttlSeconds: 301 } } },
      acknowledgeConfig: async () => ({ acknowledged: true }),
      replaceCapabilities: async () => ({}),
      replaceInventory: async () => ({}),
      reportCommissioning: async () => ({}),
    } as unknown as ControlPlaneClient;
    const runtime = new AgentRuntime({
      config: defaultConfig({ heartbeatIntervalMs: 1 }), stateStore: store,
      credentialStore: { load: async () => ({ deviceSecret: "device-secret" }) } as CredentialStore,
      client, probes: new SimulationProbeAdapter(), media, mediaBindings: bindings,
      logger: { log: (_level, event) => { if (event === "agent_cycle_complete" || event === "agent_cycle_failed") runtime.stop(); } },
    });
    await runtime.run();
    assert.ok(stored.every((state) => !state.includes("rtsp:") && !state.includes("device-secret") && !state.includes("\"sources\"")));
    assert.deepEqual(events.includes("start"), valid);
    assert.ok(events.includes("stop"));
    if (!valid) assert.ok(stored.some((state) => state.includes("invalid_device_config")));
  }
});

test("performance directives follow config revocation, stop, and restart re-fetch without persistence", async () => {
  const now = new Date("2026-01-01T00:00:01.000Z");
  const publicId = "123e4567-e89b-42d3-a456-426614174000";
  const response: ControlPlaneConfig = {
    ok: true, deviceId: 7, model: "nightly-box", venueId: 9, configRevision: "rev-1", configAvailable: true,
    timestamp: now.toISOString(),
    sections: {
      privacy: { mode: "private", contentEligibility: "approved", publicPublishingEnabled: true, revision: 1 },
      service: { entitlementState: "active", hotReelEligible: true, liveEligible: false, revision: 1 },
      media: { revision: "rev-1", ttlSeconds: 300, sources: [{ sourceId: 3, deviceId: 7, venueId: 9, sourceType: "ip_camera", venueCameraId: 5, enabled: true, capability: "rtsp" }] },
      recovery: { enabled: false },
      performance: { revision: "rev-1", ttlSeconds: 300, sessions: [{ publicId, deviceId: 7, venueId: 9,
        sources: [{ sourceId: 3, role: "camera" }], startedAt: "2026-01-01T00:00:00.000Z",
        leaseExpiresAt: "2026-01-01T12:00:00.000Z", includeMicrophone: false, mediaRevision: 1 }] },
    },
  };
  const saved: string[] = [];
  const store: AgentStateStore = {
    load: async () => ({ ...defaultState(), deviceId: 7 }),
    save: async (state) => { saved.push(JSON.stringify(state)); },
  };
  const runCycles = async (responses: ControlPlaneConfig[], expected: Array<string | null>) => {
    let count = 0;
    const observed: Array<string | null> = [];
    const failures: Array<string | null> = [];
    const client = {
      heartbeat: async () => ({ device: { id: 7, uuid: "device-uuid", venueId: 9, status: "active" } }),
      getStatus: async () => ({ device: { id: 7, uuid: "device-uuid", venueId: 9, managementAccessLevel: "owner_assisted" } }),
      getConfig: async () => responses[Math.min(count, responses.length - 1)],
      acknowledgeConfig: async () => ({ acknowledged: true }),
      replaceCapabilities: async () => ({}), replaceInventory: async () => ({}), reportCommissioning: async () => ({}),
    } as unknown as ControlPlaneClient;
    const runtime = new AgentRuntime({
      config: defaultConfig({ heartbeatIntervalMs: 1, simulation: true }), stateStore: store,
      credentialStore: { load: async () => ({ deviceSecret: "device-secret" }) } as CredentialStore,
      client, probes: new SimulationProbeAdapter(), mediaBindings: new DeviceMediaBindings(undefined, () => now.getTime()),
      now: () => now,
      logger: { log: (_level, event, fields) => {
        if (event === "agent_cycle_failed") {
          failures.push(typeof fields?.code === "string" ? fields.code : null);
          runtime.stop();
        }
        if (event !== "agent_cycle_complete") return;
        observed.push(runtime.resolvePerformanceSession(3, now.getTime() - 500, now.getTime())?.publicId ?? null);
        count += 1;
        if (count === responses.length) runtime.stop();
      } },
    });
    await runtime.run();
    assert.deepEqual(failures, []);
    assert.deepEqual(observed, expected);
    assert.equal(runtime.resolvePerformanceSession(3, now.getTime() - 500, now.getTime()), null);
  };
  await runCycles([response, { ...response, configAvailable: false, configRevision: null }], [publicId, null]);
  await runCycles([response], [publicId]);
  assert.ok(saved.every((state) => !state.includes(publicId) && !state.includes("performance") && !state.includes("sourceIds")));
});