import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import { nightlyDeviceProvisioningStateEnum } from "../db/schema";
import { CertificationManifestStore } from "./helpers/nightly-device-cert-manifest";
import { CertificationResultStore, normalizeCertificationStageName, validateCertificationResult } from "./helpers/certification-result";
import { developmentDatabaseIdentityFailure } from "./helpers/development-db-identity";
import { classifyMediaCertificationError } from "./helpers/media-certification-error";

const certifiedDeviceState = {
  lifecycleState: "active",
  provisioningState: "provisioned",
  claimState: "claimed",
  serviceEntitlementState: "active",
  managementAccessLevel: "owner_assisted",
  privacyMode: "private",
  contentEligibility: "approved",
  hotReelEligible: true,
  publicPublishingEnabled: true,
} as const;

test("media certification device fixture uses the post-bootstrap provisioning state", () => {
  assert.ok(nightlyDeviceProvisioningStateEnum.enumValues.includes(certifiedDeviceState.provisioningState));
  assert.equal(certifiedDeviceState.provisioningState, "provisioned");
});

test("media certification artifacts contain only fixture-safe result fields", () => {
  const name = normalizeCertificationStageName("http://localhost:3100/api/device/v1/media-credentials?authorization=Bearer%20private-value");
  assert.doesNotMatch(name, /localhost|private-value|bearer|authorization/i);
  const artifact = {
    schemaVersion: 1 as const, runId: `1-${randomUUID()}`, startedAt: new Date(0).toISOString(), completedAt: null,
    developmentIdentityVerified: false, status: "RUNNING" as const, failedStage: null, stages: [],
    databaseCleanup: { status: "NOT_RUN" as const, remainingFixtures: null },
    clerkCleanup: { status: "PASS" as const, remainingKnownSessions: 0 },
  };
  assert.equal(validateCertificationResult(artifact), true);
  assert.doesNotMatch(JSON.stringify(artifact), /fakepass|bearer|rtsp:\/\/|password|sessionIds|deviceSecret/i);
});

const enabled = process.env.NIGHTLY_MEDIA_CREDENTIAL_CERTIFICATION === "true";
if (enabled) {
  config({ path: ".env.local", override: true, quiet: true });
  delete process.env.PGOPTIONS;
}

test("Development media binding and credential certification", { skip: !enabled, timeout: 180_000 }, async () => {
  const manifest = await CertificationManifestStore.create();
  const result = await CertificationResultStore.create(manifest.value.runId);
  const prefix = manifest.value.fixturePrefix;
  const deadline = Date.now() + 180_000;
  const overall = new AbortController();
  const timer = setTimeout(() => overall.abort(), 140_000);
  let failed = false;
  let timedOut = false;
  let verified = false;
  let cleanupPassed = false;
  let pool: import("pg").Pool | undefined;
  let db: ReturnType<typeof import("drizzle-orm/node-postgres").drizzle> | undefined;

  async function stage<T>(name: string, action: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      if (overall.signal.aborted || Date.now() >= deadline) throw new Error("deadline");
      const value = await action();
      if (overall.signal.aborted || Date.now() >= deadline) throw new Error("deadline");
      await result.stage(name, "PASS", Date.now() - start);
      return value;
    } catch (error) {
      failed = true;
      timedOut ||= overall.signal.aborted || Date.now() >= deadline;
      await result.stage(name, timedOut ? "TIMEOUT" : "FAIL", Date.now() - start);
      if (!timedOut) console.error(JSON.stringify({ stage: normalizeCertificationStageName(name), database: classifyMediaCertificationError(error) }));
      throw new Error(`Certification failed at ${name}; inspect the private result artifact.`);
    }
  }

  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    await stage("preflight.local-server", async () => {
      const response = await fetch("http://localhost:3100/api/device/v1/config", { signal: AbortSignal.any([overall.signal, AbortSignal.timeout(10_000)]) });
      assert.equal(response.status, 401);
    });
    const [{ Pool, Client }, { drizzle }, orm, schema, revision] = await Promise.all([
      import("pg"), import("drizzle-orm/node-postgres"), import("drizzle-orm"),
      import("../db/schema"), import("../lib/nightly-device/media-revision"),
    ]);
    const { and, eq, inArray, like, sql } = orm;
    const { nightlyDevices, nightlyDeviceSources, venueCameras, venues, auditLogs } = schema;
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000, query_timeout: 10_000, lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000, allowExitOnIdle: true });
    const database = drizzle(pool, { schema });
    db = database;
    const connection = pool;
    const cameraIds: number[] = [];
    const sourceIds: number[] = [];

    async function counts() {
      const ids = manifest.value.deviceIds;
      const [devices, cameras, sources, linkedSources, audits] = await Promise.all([
        database.select({ n: sql<number>`count(*)::int` }).from(nightlyDevices).where(like(nightlyDevices.serialNumber, `${prefix}%`)),
        database.select({ n: sql<number>`count(*)::int` }).from(venueCameras).where(like(venueCameras.name, `${prefix}%`)),
        database.select({ n: sql<number>`count(*)::int` }).from(nightlyDeviceSources).where(like(nightlyDeviceSources.sourceLabel, `${prefix}%`)),
        ids.length ? database.select({ n: sql<number>`count(*)::int` }).from(nightlyDeviceSources).where(inArray(nightlyDeviceSources.deviceId, ids)) : Promise.resolve([{ n: 0 }]),
        ids.length ? database.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(and(eq(auditLogs.entityType, "nightly_device"), inArray(auditLogs.entityId, ids.map(String)))) : Promise.resolve([{ n: 0 }]),
      ]);
      return Number(devices[0]?.n) + Number(cameras[0]?.n) + Number(sources[0]?.n) + Number(linkedSources[0]?.n) + Number(audits[0]?.n);
    }

    async function request(path: "config" | "media-credentials" | "inventory" | "status" | "heartbeat", device: { uuid: string; secret: string }, body?: unknown) {
      const response = await fetch(`http://localhost:3100/api/device/v1/${path}`, {
        method: path === "config" ? "GET" : "POST",
        headers: { authorization: `Bearer ${device.secret}`, "x-nightly-device-uuid": device.uuid, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store", signal: AbortSignal.any([overall.signal, AbortSignal.timeout(10_000)]),
      });
      const text = await response.text();
      return { status: response.status, text, payload: JSON.parse(text) as Record<string, unknown> };
    }

    function noCredential(text: string) {
      assert.doesNotMatch(text, /fakepass|rtsp:\/\/|streamUrl|Bearer |authorization|deviceSecretHash|username|password|authHeader/i);
    }

    await stage("preflight.fresh-pool-and-drizzle", async () => {
      assert.equal((await connection.query("select 1 as ok")).rows[0]?.ok, 1);
      const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
      try {
        await client.connect();
        assert.equal((await client.query("select 1 as ok")).rows[0]?.ok, 1);
      } finally { await client.end(); }
      assert.equal((await database.execute(sql`select 1 as ok`)).rows[0]?.ok, 1);
      const identity = (await database.execute(sql`select current_database() as database_name, current_setting('neon.project_id',true) as project_id, current_setting('neon.branch_id',true) as branch_id, current_setting('neon.endpoint_id',true) as endpoint_id`)).rows[0];
      assert.match(url.hostname, /^ep-silent-hat-at3rhpgq(?:-pooler)?\.[a-z0-9.-]+\.neon\.tech$/);
      assert.notEqual(url.hostname.includes("ep-rough-mud-"), true);
      assert.equal(developmentDatabaseIdentityFailure({ hostname: url.hostname, projectId: identity?.project_id as string,
        branchId: identity?.branch_id as string, endpointId: identity?.endpoint_id as string, databaseName: identity?.database_name as string }), null);
      assert.notEqual(identity?.branch_id, "br-dry-dew-at2z1st2");
      assert.notEqual(identity?.endpoint_id, "ep-rough-mud-atcx5jvx");
      assert.equal(await counts(), 0);
      verified = true;
      await result.setDevelopmentIdentityVerified(true);
    });

    const parents = await stage("preflight.existing-venues", () => database.select({ id: venues.id }).from(venues).orderBy(venues.id).limit(2));
    assert.equal(parents.length, 2);
    const devices: Array<{ id: number; uuid: string; secret: string; venueId: number }> = [];
    for (const [index, venueId] of [parents[0]!.id, parents[1]!.id, parents[0]!.id].entries()) {
      await stage(`fixture.device.${index}`, async () => {
        const secret = randomBytes(32).toString("base64url");
        const uuid = randomUUID();
        const [row] = await database.insert(nightlyDevices).values({ venueId, publicDeviceUuid: uuid,
          serialNumber: `${prefix}-device-${index}`, deviceSecretHash: createHash("sha256").update(secret).digest("hex"),
          ...certifiedDeviceState, desiredConfigRevision: randomUUID() }).returning({ id: nightlyDevices.id });
        assert.ok(row);
        devices.push({ id: row.id, uuid, secret, venueId });
        await manifest.recordDevice(row.id);
      });
    }
    const [deviceA, deviceB, deviceC] = devices as [typeof devices[number], typeof devices[number], typeof devices[number]];
    for (const [index, device] of [deviceA, deviceB].entries()) {
      await stage(`fixture.camera-source.${index}`, async () => {
        const [camera] = await database.insert(venueCameras).values({ venueId: device.venueId, name: `${prefix}-camera-${index}`,
          streamType: "rtsp", streamUrl: "rtsp://user:fakepass@camera.invalid/live", status: "enabled" }).returning({ id: venueCameras.id });
        assert.ok(camera);
        cameraIds.push(camera.id);
        const [source] = await database.insert(nightlyDeviceSources).values({ deviceId: device.id, venueId: device.venueId,
          sourceType: "ip_camera", sourceLabel: `${prefix}-source-${index}`, venueCameraId: camera.id }).returning({ id: nightlyDeviceSources.id });
        assert.ok(source);
        sourceIds.push(source.id);
      });
    }

    async function configFor(device: typeof deviceA) {
      const response = await request("config", device);
      assert.equal(response.status, 200);
      noCredential(response.text);
      const media = (response.payload.sections as { media: { revision: string; sources: Array<{ sourceId: number; venueCameraId: number }> } }).media;
      assert.equal(response.payload.configRevision, media.revision);
      return media;
    }
    async function credential(device: typeof deviceA, sourceId: number, revisionValue: string, status: number) {
      const response = await request("media-credentials", device, { sourceId, expectedRevision: revisionValue });
      assert.equal(response.status, status);
      if (status === 200) {
        assert.equal(response.payload.sourceId, sourceId);
        assert.equal(response.payload.streamUrl, "rtsp://user:fakepass@camera.invalid/live");
        assert.equal(response.payload.configRevision, revisionValue);
        assert.equal(response.payload.ttlSeconds, 60);
        assert.ok(Date.parse(String(response.payload.expiresAt)) > Date.now());
      } else noCredential(response.text);
    }

    const initial = await stage("media.initial-config", () => configFor(deviceA));
    await stage("media.canonical-binding", async () => {
      assert.deepEqual(initial.sources.map((source) => source.sourceId), [sourceIds[0]]);
      assert.equal(initial.sources[0]?.venueCameraId, cameraIds[0]);
      const other = await configFor(deviceB);
      assert.deepEqual(other.sources.map((source) => source.sourceId), [sourceIds[1]]);
      assert.equal((await configFor(deviceC)).sources.length, 0);
      await credential(deviceA, sourceIds[0]!, initial.revision, 200);
      await credential(deviceA, sourceIds[1]!, initial.revision, 404);
      await credential(deviceB, sourceIds[0]!, other.revision, 404);
      await credential(deviceC, sourceIds[0]!, (await configFor(deviceC)).revision, 404);
    });
    await stage("media.noop-inventory", async () => {
      const before = await database.select({ id: nightlyDeviceSources.id }).from(nightlyDeviceSources).where(eq(nightlyDeviceSources.deviceId, deviceA.id));
      const reported = await request("inventory", deviceA, { sources: [] });
      assert.equal(reported.status, 200);
      noCredential(reported.text);
      const after = await database.select({ id: nightlyDeviceSources.id }).from(nightlyDeviceSources).where(eq(nightlyDeviceSources.deviceId, deviceA.id));
      assert.deepEqual(after, before);
      const next = await configFor(deviceA);
      assert.equal(next.revision, initial.revision);
      assert.deepEqual(next.sources, initial.sources);
    });
    await stage("media.disabled-source", async () => {
      await database.update(nightlyDeviceSources).set({ enabled: false }).where(eq(nightlyDeviceSources.id, sourceIds[0]!));
      assert.deepEqual((await configFor(deviceA)).sources, []);
      await credential(deviceA, sourceIds[0]!, initial.revision, 404);
      await database.update(nightlyDeviceSources).set({ enabled: true }).where(eq(nightlyDeviceSources.id, sourceIds[0]!));
      await database.update(venueCameras).set({ status: "disabled" }).where(eq(venueCameras.id, cameraIds[0]!));
      assert.deepEqual((await configFor(deviceA)).sources, []);
      await credential(deviceA, sourceIds[0]!, initial.revision, 404);
      await database.update(venueCameras).set({ status: "enabled" }).where(eq(venueCameras.id, cameraIds[0]!));
    });
    await stage("media.canonical-content-policy", async () => {
      for (const state of [
        { contentEligibility: "restricted" as const },
        { contentEligibility: "blocked" as const },
        { hotReelEligible: false },
        { publicPublishingEnabled: false },
        { serviceSuspendedAt: new Date() },
        { serviceEntitlementState: "inactive" as const },
      ]) {
        await database.update(nightlyDevices).set(state).where(eq(nightlyDevices.id, deviceA.id));
        await credential(deviceA, sourceIds[0]!, initial.revision, 403);
        await database.update(nightlyDevices).set({ ...certifiedDeviceState, serviceSuspendedAt: null }).where(eq(nightlyDevices.id, deviceA.id));
      }
      await credential(deviceA, sourceIds[0]!, initial.revision, 200);
    });
    await stage("media.recovery-and-revoked", async () => {
      await database.update(nightlyDevices).set({ managementAccessLevel: "recovery_only" }).where(eq(nightlyDevices.id, deviceA.id));
      assert.equal((await request("config", deviceA)).status, 403);
      await credential(deviceA, sourceIds[0]!, initial.revision, 403);
      await database.update(nightlyDevices).set({ managementAccessLevel: "owner_assisted", lifecycleState: "revoked" }).where(eq(nightlyDevices.id, deviceA.id));
      await credential(deviceA, sourceIds[0]!, initial.revision, 403);
      await database.update(nightlyDevices).set({ lifecycleState: "active", managementAccessLevel: "disabled" }).where(eq(nightlyDevices.id, deviceA.id));
      await credential(deviceA, sourceIds[0]!, initial.revision, 403);
      await database.update(nightlyDevices).set({ managementAccessLevel: "owner_assisted" }).where(eq(nightlyDevices.id, deviceA.id));
    });
    await stage("media.camera-mutation-revision", async () => {
      await database.transaction(async (tx) => {
        await tx.update(venueCameras).set({ streamUrl: "rtsp://user:fakepass@camera.invalid/next" }).where(eq(venueCameras.id, cameraIds[0]!));
        await revision.rotateCameraMediaRevision(tx, deviceA.venueId, cameraIds[0]!);
      });
      const next = await configFor(deviceA);
      assert.notEqual(next.revision, initial.revision);
      await credential(deviceA, sourceIds[0]!, initial.revision, 409);
      const fresh = await request("media-credentials", deviceA, { sourceId: sourceIds[0], expectedRevision: next.revision });
      assert.equal(fresh.status, 200);
      assert.equal(fresh.payload.streamUrl, "rtsp://user:fakepass@camera.invalid/next");
    });
    await stage("media.same-venue-reassignment", async () => {
      await database.transaction(async (tx) => {
        await tx.update(nightlyDeviceSources).set({ deviceId: deviceC.id }).where(eq(nightlyDeviceSources.id, sourceIds[0]!));
        await tx.update(nightlyDevices).set({ desiredConfigRevision: randomUUID() }).where(inArray(nightlyDevices.id, [deviceA.id, deviceC.id]));
      });
      const oldConfig = await configFor(deviceA);
      const newConfig = await configFor(deviceC);
      assert.deepEqual(oldConfig.sources, []);
      assert.deepEqual(newConfig.sources.map((source) => source.sourceId), [sourceIds[0]]);
      await credential(deviceA, sourceIds[0]!, oldConfig.revision, 404);
      const fresh = await request("media-credentials", deviceC, { sourceId: sourceIds[0], expectedRevision: newConfig.revision });
      assert.equal(fresh.status, 200);
      assert.equal(fresh.payload.streamUrl, "rtsp://user:fakepass@camera.invalid/next");
      const status = await request("status", deviceC);
      assert.equal(status.status, 200);
      noCredential(status.text);
      const health = await request("heartbeat", deviceC, { operationalState: "healthy" });
      assert.equal(health.status, 200);
      noCredential(health.text);
    });
  } catch {
    failed = true;
    throw new Error(`Media certification failed; inspect ${result.path} and the private manifest for recovery.`);
  } finally {
    clearTimeout(timer);
    if (verified && db) {
      try {
        const orm = await import("drizzle-orm");
        const schema = await import("../db/schema");
        const owned = await db.select({ id: schema.nightlyDevices.id }).from(schema.nightlyDevices)
          .where(orm.like(schema.nightlyDevices.serialNumber, `${prefix}%`));
        const ids = [...new Set([...manifest.value.deviceIds, ...owned.map((row) => row.id)])];
        if (manifest.value.deviceIds.length !== owned.filter((row) => manifest.value.deviceIds.includes(row.id)).length) {
          throw new Error("Manifest ID does not match an owned fixture.");
        }
        await db.transaction(async (tx) => {
          if (ids.length) {
            await tx.delete(schema.auditLogs).where(orm.and(orm.eq(schema.auditLogs.entityType, "nightly_device"), orm.inArray(schema.auditLogs.entityId, ids.map(String))));
            await tx.delete(schema.nightlyDeviceSources).where(orm.inArray(schema.nightlyDeviceSources.deviceId, ids));
            await tx.delete(schema.nightlyDevices).where(orm.inArray(schema.nightlyDevices.id, ids));
          }
          await tx.delete(schema.nightlyDeviceSources).where(orm.like(schema.nightlyDeviceSources.sourceLabel, `${prefix}%`));
          await tx.delete(schema.venueCameras).where(orm.like(schema.venueCameras.name, `${prefix}%`));
        });
        const [devices, cameras, sources, dependent, audits, claims, assignments, capabilities, commissioning] = await Promise.all([
          db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDevices).where(orm.like(schema.nightlyDevices.serialNumber, `${prefix}%`)),
          db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.venueCameras).where(orm.like(schema.venueCameras.name, `${prefix}%`)),
          db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDeviceSources).where(orm.like(schema.nightlyDeviceSources.sourceLabel, `${prefix}%`)),
          ids.length ? db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDeviceSources).where(orm.inArray(schema.nightlyDeviceSources.deviceId, ids)) : Promise.resolve([{ n: 0 }]),
          ids.length ? db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.auditLogs).where(orm.and(orm.eq(schema.auditLogs.entityType, "nightly_device"), orm.inArray(schema.auditLogs.entityId, ids.map(String)))) : Promise.resolve([{ n: 0 }]),
          ids.length ? db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDeviceClaims).where(orm.inArray(schema.nightlyDeviceClaims.deviceId, ids)) : Promise.resolve([{ n: 0 }]),
          ids.length ? db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDeviceAssignments).where(orm.inArray(schema.nightlyDeviceAssignments.deviceId, ids)) : Promise.resolve([{ n: 0 }]),
          ids.length ? db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDeviceCapabilities).where(orm.inArray(schema.nightlyDeviceCapabilities.deviceId, ids)) : Promise.resolve([{ n: 0 }]),
          ids.length ? db.select({ n: orm.sql<number>`count(*)::int` }).from(schema.nightlyDeviceCommissioningChecks).where(orm.inArray(schema.nightlyDeviceCommissioningChecks.deviceId, ids)) : Promise.resolve([{ n: 0 }]),
        ]);
        const remaining = [devices, cameras, sources, dependent, audits, claims, assignments, capabilities, commissioning].reduce((total, rows) => total + Number(rows[0]?.n), 0);
        cleanupPassed = remaining === 0;
        await result.setDatabaseCleanup(cleanupPassed ? "PASS" : "FAIL", remaining);
        if (!cleanupPassed) {
          failed = true;
          await result.stage("cleanup.database", "FAIL", 0);
        }
      } catch {
        failed = true;
        await result.setDatabaseCleanup("FAIL", null);
        await result.stage("cleanup.database", "FAIL", 0);
      }
    }
    const noSessions = manifest.value.sessionIds.length === 0 && manifest.value.pendingSessionUserId === null;
    await result.setClerkCleanup(noSessions ? "PASS" : "FAIL", noSessions ? 0 : null);
    if (!noSessions) {
      failed = true;
      await result.stage("cleanup.clerk", "FAIL", 0);
    }
    try { await pool?.end(); } catch {
      failed = true;
      cleanupPassed = false;
      await result.setDatabaseCleanup("FAIL", null);
      await result.stage("cleanup.database-pool", "FAIL", 0);
    }
    if (cleanupPassed && noSessions) await manifest.remove();
    await result.finish(!failed && cleanupPassed ? "PASS" : timedOut ? "TIMEOUT" : "FAIL", failed ? "certification.or-cleanup" : null);
    if (!cleanupPassed) throw new Error(`Cleanup not verified; retain private manifest at ${manifest.path}.`);
  }
});