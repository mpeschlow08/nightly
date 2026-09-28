import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import { CertificationManifestStore } from "./helpers/nightly-device-cert-manifest";
import { CertificationResultStore } from "./helpers/certification-result";
import { developmentDatabaseIdentityFailure } from "./helpers/development-db-identity";

if (process.env.NIGHTLY_DEVICE_API_CERTIFICATION === "true") {
  config({ path: ".env.local", override: true, quiet: true });
  delete process.env.PGOPTIONS;
}

type ApiPayload = {
  device?: {
    id?: number;
    publicDeviceUuid?: string;
    serialNumber?: string;
    serviceEntitlementState?: string;
    managementAccessLevel?: string;
  };
  bootstrapToken?: string;
  deviceSecret?: string;
  expiresAt?: string;
  configRevision?: string;
  sections?: {
    privacy?: { mode?: string };
    recovery?: { enabled?: boolean };
  };
  sources?: unknown[];
};

class CertificationStageTimeout extends Error {
  constructor(readonly stage: string) {
    super("timeout");
    this.name = "CertificationStageTimeout";
  }
}

class CertificationStageFailure extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "CertificationStageFailure";
  }
}

let activeResultStore: CertificationResultStore | null = null;
let activeStageName: string | null = null;
let activeTerminalStatus: "FAIL" | "TIMEOUT" = "FAIL";

async function runStage<T>(name: string, operation: () => Promise<T>, timeoutMs = 15_000): Promise<T> {
  activeStageName = name;
  console.error(`[device-cert] stage:start ${name}`);
  let timer: NodeJS.Timeout | undefined;
  const startedAt = performance.now();
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CertificationStageTimeout(name)), timeoutMs);
    });
    const result = await Promise.race([operation(), timeout]);
    console.error(`[device-cert] stage:pass ${name}`);
    await activeResultStore?.stage(name, "PASS", performance.now() - startedAt);
    return result;
  } catch (error) {
    const timedOut = error instanceof CertificationStageTimeout;
    if (timedOut) activeTerminalStatus = "TIMEOUT";
    const reason = timedOut ? "timeout" : error instanceof CertificationStageFailure ? error.reason : error instanceof Error ? error.name : "unknown_error";
    console.error(`[device-cert] stage:fail ${name} reason=${reason}`);
    await activeResultStore?.stage(name, timedOut ? "TIMEOUT" : "FAIL", performance.now() - startedAt);
    throw new Error(`Certification stage failed: ${name} (${reason}).`);
  } finally {
    if (timer) clearTimeout(timer);
    if (activeStageName === name) activeStageName = null;
  }
}

async function assertResponseStatus(stage: string, response: Response, expectedStatus: number) {
  await runStage(stage, async () => {
    if (response.status !== expectedStatus) throw new CertificationStageFailure(`http_status_${response.status}_expected_${expectedStatus}`);
  });
}

test(
  "Nightly device v1 API and persistence certify against Development",
  { skip: process.env.NIGHTLY_DEVICE_API_CERTIFICATION !== "true", timeout: 300_000 },
  async () => {
    const [drizzleOrm, drizzlePg, pgModule, schema, clerkServer, deviceAuth, policy] = await Promise.all([
      import("drizzle-orm"),
      import("drizzle-orm/node-postgres"),
      import("pg"),
      import("../db/schema"),
      import("@clerk/nextjs/server"),
      import("../lib/nightly-device/auth"),
      import("../lib/nightly-device/policy"),
    ]);
    const { Pool } = pgModule;
    const { and, asc, eq, gt, inArray, isNull, like, or } = drizzleOrm;
    const {
      adminAssignments,
      auditLogs,
      nightlyDeviceAssignments,
      nightlyDeviceCapabilities,
      nightlyDeviceClaims,
      nightlyDeviceCommissioningChecks,
      nightlyDeviceSources,
      nightlyDevices,
      venueCameras,
      venueMembers,
      venueStaffProfiles,
      users,
    } = schema;
    const manifestStore = await CertificationManifestStore.create();
    const resultStore = await CertificationResultStore.create(manifestStore.value.runId);
    activeResultStore = resultStore;
    activeStageName = null;
    activeTerminalStatus = "FAIL";
    const fixturePrefix = manifestStore.value.fixturePrefix;
    console.error(`[device-cert] run=${manifestStore.value.runId} result=${resultStore.path}`);
    const overallTimer = setTimeout(() => {
      void resultStore.finish("TIMEOUT", activeStageName ?? "overall.timeout");
    }, 285_000);
    overallTimer.unref();
    const apiBase = process.env.NIGHTLY_CERT_BASE_URL ?? "http://localhost:3100";
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      query_timeout: 12_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
      allowExitOnIdle: true,
    });
    const db = drizzlePg.drizzle(pool, { schema });
    console.error(`[device-cert] fixtures=${fixturePrefix}`);
    let clerk!: Awaited<ReturnType<typeof clerkServer.clerkClient>>;

    async function sessionFor(clerkUserId: string) {
      await manifestStore.beginSession(clerkUserId);
      const session = await runStage("clerk.session.create", () => clerk.sessions.createSession({ userId: clerkUserId }), 20_000);
      await manifestStore.recordSession(session.id);
      const token = await runStage("clerk.session.token", () => clerk.sessions.getToken(session.id), 20_000);
      return token.jwt;
    }

    async function api(path: string, input: {
      method?: string;
      token?: string;
      body?: unknown;
    } = {}) {
      const headers = new Headers();
      if (input.token) headers.set("authorization", `Bearer ${input.token}`);
      if (typeof input.body !== "undefined") headers.set("content-type", "application/json");
      const response = await deviceFetch(`${apiBase}${path}`, {
        method: input.method ?? (typeof input.body === "undefined" ? "GET" : "POST"),
        headers,
        body: typeof input.body === "undefined" ? undefined : JSON.stringify(input.body),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      return { response, payload };
    }

    let requestSequence = 0;
    async function deviceFetch(url: string, init: RequestInit = {}) {
      const path = new URL(url).pathname;
      const requestId = ++requestSequence;
      return runStage(`http.${path}#${requestId}`, () => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }), 12_000);
    }

    const createdDevices: Array<{ id: number; publicDeviceUuid: string; serialNumber: string; deviceSecret: string }> = [];
    let adminToken: string | null = null;
    let ownerToken: string | null = null;
    let otherOwnerToken: string | null = null;
    let techToken: string | null = null;
    let developmentIdentityVerified = false;
    let bodyFailure: string | null = null;
    let databaseCleanupStatus: "NOT_RUN" | "PASS" | "FAIL" = "NOT_RUN";
    let clerkCleanupStatus: "NOT_RUN" | "PASS" | "FAIL" = "NOT_RUN";
    let remainingFixtureCount: number | null = null;
    let remainingKnownSessionCount: number | null = null;

    try {
      await runStage("safety.api-base-local", async () => {
        if (!new Set(["localhost", "127.0.0.1", "::1"]).has(new URL(apiBase).hostname)) throw new CertificationStageFailure("api_base_not_local");
      });
      clerk = await runStage("clerk.client.initialize", () => clerkServer.clerkClient(), 15_000);
      const url = new URL(process.env.DATABASE_URL ?? "");
      const identity = await runStage("safety.development-database-identity", async () => {
        const identityResult = await db.execute(drizzleOrm.sql.raw(
          "select current_database() as database_name,current_setting('neon.project_id',true) as project_id,current_setting('neon.branch_id',true) as branch_id,current_setting('neon.endpoint_id',true) as endpoint_id"
        ));
        const row = identityResult.rows[0] as {
          project_id?: string;
          branch_id?: string;
          endpoint_id?: string;
          database_name?: string;
        } | undefined;
        const failure = developmentDatabaseIdentityFailure({
          hostname: url.hostname,
          projectId: row?.project_id,
          branchId: row?.branch_id,
          endpointId: row?.endpoint_id,
          databaseName: row?.database_name,
        });
        if (failure) throw new CertificationStageFailure(failure);
        return row;
      });
      developmentIdentityVerified = true;
      await resultStore.setDevelopmentIdentityVerified(true);
      await resultStore.setDevelopmentIdentityVerified(true);

      const [admin] = await runStage("actors.find-active-admin", () => db
        .select({ clerkUserId: users.clerkUserId })
        .from(users)
        .innerJoin(adminAssignments, eq(adminAssignments.clerkUserId, users.clerkUserId))
        .where(and(
          eq(users.role, "admin"),
          eq(users.accountStatus, "active"),
          eq(adminAssignments.status, "active"),
          or(isNull(adminAssignments.expiresAt), gt(adminAssignments.expiresAt, new Date()))
        ))
        .limit(1));
      const owners = await runStage("actors.find-owners", () => db
        .select({ clerkUserId: users.clerkUserId, venueId: venueMembers.venueId })
        .from(venueMembers)
        .innerJoin(users, eq(users.clerkUserId, venueMembers.clerkUserId))
        .where(eq(venueMembers.role, "owner"))
        .orderBy(asc(venueMembers.venueId)));
      const owner = owners[0];
      const otherOwner = owners.find((candidate) => candidate.venueId !== owner?.venueId && candidate.clerkUserId !== owner.clerkUserId);
      assert.ok(admin?.clerkUserId, "Development admin actor is unavailable.");
      assert.ok(owner?.clerkUserId, "Development venue owner actor is unavailable.");
      assert.ok(otherOwner?.clerkUserId, "A distinct second owner is required for cross-venue certification.");

      adminToken = await sessionFor(admin.clerkUserId);
      ownerToken = await sessionFor(owner.clerkUserId);
      otherOwnerToken = await sessionFor(otherOwner.clerkUserId);

      const consumers = await runStage("actors.find-consumers", () => db
        .select({ clerkUserId: users.clerkUserId })
        .from(users)
        .where(and(eq(users.role, "consumer"), eq(users.accountStatus, "active")))
        .limit(20));
      let techUserId: string | null = null;
      for (const consumer of consumers) {
        try {
          await runStage("clerk.find-tech-operator", () => clerk.users.getUser(consumer.clerkUserId), 20_000);
          techUserId = consumer.clerkUserId;
          break;
        } catch {
          continue;
        }
      }
      assert.ok(techUserId, "A Development Clerk consumer identity is required for Tech Operator certification.");
      techToken = await sessionFor(techUserId);
      await db.insert(venueStaffProfiles).values({
        venueId: owner.venueId,
        clerkUserId: techUserId,
        firstName: "Nightly",
        lastName: "Certification Operator",
        email: `${fixturePrefix.toLowerCase()}@invalid.example`,
        department: "operations",
        jobTitle: "Tech Operator Certification Fixture",
        permissionsJson: JSON.stringify(["nightly_device:operate"]),
        status: "active",
      });

      const unauthenticatedEnroll = await api("/api/device/v1/enroll", {
        method: "POST",
        body: { serialNumber: `${fixturePrefix}-UNAUTH` },
      });
      assert.equal(unauthenticatedEnroll.response.status, 403);

      async function enrollAndBootstrap(suffix: string) {
        const serialNumber = `${fixturePrefix}-${suffix}`;
        const enrolled = await api("/api/device/v1/enroll", {
          token: adminToken!,
          body: { serialNumber },
        });
        assert.equal(enrolled.response.status, 201);
        assert.equal(enrolled.response.headers.get("cache-control"), "no-store");
        const device = enrolled.payload?.device;
        const bootstrapToken = enrolled.payload?.bootstrapToken as string;
        assert.ok(device?.id && device.publicDeviceUuid && device.serialNumber === serialNumber);
        assert.equal(typeof bootstrapToken, "string");
        assert.ok(bootstrapToken.length >= 40);
        await manifestStore.recordDevice(device.id!);

        const [persisted] = await db.select().from(nightlyDevices).where(eq(nightlyDevices.id, device.id)).limit(1);
        assert.ok(persisted);
        assert.equal(persisted.bootstrapTokenHash, deviceAuth.hashDeviceSecret(bootstrapToken));
        assert.equal(persisted.deviceSecretHash, null);
        assert.equal(persisted.lifecycleState, "inventory");
        assert.equal(persisted.provisioningState, "inventory");
        assert.equal(persisted.claimState, "unclaimed");
        assert.equal(persisted.serviceEntitlementState, "inactive");
        assert.equal(persisted.privacyMode, "private");
        assert.equal(persisted.contentEligibility, "restricted");
        assert.equal(persisted.publicPublishingEnabled, false);
        assert.equal(persisted.hotReelEligible, false);
        assert.equal(persisted.liveEligible, false);
        assert.equal(persisted.managementRecoveryEligible, true);
        assert.equal(JSON.stringify(enrolled.payload).includes(persisted.deviceSecretHash ?? "__none__"), false);

        const invalidBootstrap = await api("/api/device/v1/bootstrap", {
          body: { publicDeviceUuid: device.publicDeviceUuid, serialNumber, bootstrapToken: `${bootstrapToken}wrong` },
        });
        assert.equal(invalidBootstrap.response.status, 401);

        const bootstrapped = await api("/api/device/v1/bootstrap", {
          body: { publicDeviceUuid: device.publicDeviceUuid, serialNumber, bootstrapToken },
        });
        assert.equal(bootstrapped.response.status, 200);
        assert.equal(bootstrapped.response.headers.get("cache-control"), "no-store");
        const deviceSecret = bootstrapped.payload?.deviceSecret as string;
        assert.ok(deviceSecret && deviceSecret.length >= 40);
        assert.equal(JSON.stringify(bootstrapped.payload).includes(persisted.bootstrapTokenHash), false);
        assert.equal("deviceSecretHash" in (bootstrapped.payload?.device ?? {}), false);
        const [afterBootstrap] = await db.select().from(nightlyDevices).where(eq(nightlyDevices.id, device.id)).limit(1);
        assert.equal(afterBootstrap.bootstrapTokenHash, null);
        assert.equal(afterBootstrap.deviceSecretHash, deviceAuth.hashDeviceSecret(deviceSecret));

        const replay = await api("/api/device/v1/bootstrap", {
          body: { publicDeviceUuid: device.publicDeviceUuid, serialNumber, bootstrapToken },
        });
        assert.equal(replay.response.status, 401);

        const record = { id: device.id as number, publicDeviceUuid: device.publicDeviceUuid as string, serialNumber, deviceSecret };
        createdDevices.push(record);
        return record;
      }

      const primary = await enrollAndBootstrap("PRIMARY");
      console.error("[device-cert] primary bootstrap passed");
      const primaryHeaders = {
        authorization: `Bearer ${primary.deviceSecret}`,
        "x-nightly-device-uuid": primary.publicDeviceUuid,
      };
      const concurrent = await enrollAndBootstrap("CONCURRENT");
      const third = await enrollAndBootstrap("CLAIM-EDGE");
      console.error("[device-cert] all three devices enrolled and bootstrapped");
      const noAuthStatus = await api("/api/device/v1/status", { method: "POST" });
      assert.equal(noAuthStatus.response.status, 401);

      const directAuth = await deviceAuth.authenticateDeviceRequest(new Request(`${apiBase}/api/device/v1/status`, { headers: primaryHeaders }));
      assert.equal(directAuth?.id, primary.id);
      const wrongCredential = await deviceAuth.authenticateDeviceRequest(new Request(`${apiBase}/api/device/v1/status`, {
        headers: { authorization: `Bearer ${concurrent.deviceSecret}`, "x-nightly-device-uuid": primary.publicDeviceUuid },
      }));
      assert.equal(wrongCredential, null);

      const techIssue = await api("/api/device/v1/claim-codes", {
        token: techToken!,
        body: { publicDeviceUuid: third.publicDeviceUuid, venueId: owner.venueId, claimCode: randomBytes(32).toString("base64url") },
      });
      assert.equal(techIssue.response.status, 403);
      const ownerPage = await deviceFetch(`${apiBase}/owner/devices`, { headers: { authorization: `Bearer ${techToken}` }, cache: "no-store" });
      assert.equal(ownerPage.status, 200);
      assert.equal((await ownerPage.text()).includes("Nightly Box"), true);

      async function issueClaim(device: typeof primary) {
        const claimCode = randomBytes(32).toString("base64url");
        const issued = await api("/api/device/v1/claim-codes", {
          token: ownerToken!,
          body: { publicDeviceUuid: device.publicDeviceUuid, venueId: owner.venueId, claimCode },
        });
        assert.equal(issued.response.status, 200);
        assert.equal(issued.response.headers.get("cache-control"), "no-store");
        assert.equal(JSON.stringify(issued.payload).includes(claimCode), false);
        assert.ok(issued.payload?.expiresAt);
        const claimHash = deviceAuth.hashDeviceSecret(claimCode);
        const [persistedClaim] = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.claimCodeHash, claimHash)).limit(1);
        assert.ok(persistedClaim);
        assert.equal(persistedClaim.claimantClerkUserId, owner.clerkUserId);
        assert.equal(persistedClaim.venueId, owner.venueId);
        assert.ok(persistedClaim.expiresAt);
        assert.ok(persistedClaim.expiresAt!.getTime() > Date.now());
        assert.ok(persistedClaim.expiresAt!.getTime() - Date.now() <= 30 * 60 * 1000 + 5000);
        return { claimCode, claim: persistedClaim };
      }

      const primaryClaim = await issueClaim(primary);
      const foreignOwnerAttempt = await api("/api/device/v1/claim", {
        token: otherOwnerToken!,
        body: { publicDeviceUuid: primary.publicDeviceUuid, venueId: owner.venueId, claimCode: primaryClaim.claimCode },
      });
      assert.equal(foreignOwnerAttempt.response.status, 403);
      const [claimAfterForeignAttempt] = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, primaryClaim.claim.id)).limit(1);
      assert.equal(claimAfterForeignAttempt?.status, "pending");

      const claimed = await api("/api/device/v1/claim", {
        token: ownerToken!,
        body: { publicDeviceUuid: primary.publicDeviceUuid, venueId: owner.venueId, claimCode: primaryClaim.claimCode },
      });
      assert.equal(claimed.response.status, 200);
      console.error("[device-cert] owner claim and cross-owner denial passed");
      assert.equal(JSON.stringify(claimed.payload).includes(primaryClaim.claimCode), false);
      const [claimedDevice] = await runStage("claim.primary.persisted-state", () => db.select().from(nightlyDevices).where(eq(nightlyDevices.id, primary.id)).limit(1));
      assert.equal(claimedDevice.venueId, owner.venueId);
      assert.equal(claimedDevice.lifecycleState, "claimed");
      assert.equal(claimedDevice.claimState, "claimed");
      const assignments = await runStage("claim.primary.assignment-count", () => db.select().from(nightlyDeviceAssignments).where(and(eq(nightlyDeviceAssignments.deviceId, primary.id), eq(nightlyDeviceAssignments.status, "active"))));
      assert.equal(assignments.length, 1);
      const [consumedClaim] = await runStage("claim.primary.consumed-state", () => db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, primaryClaim.claim.id)).limit(1));
      assert.ok(consumedClaim?.usedAt);
      assert.equal(consumedClaim?.status, "claimed");
      console.error("[device-cert] stage:claim-primary-replay");
      const replayClaim = await runStage("claim.primary.replay", () => api("/api/device/v1/claim", {
        token: ownerToken!,
        body: { publicDeviceUuid: primary.publicDeviceUuid, venueId: owner.venueId, claimCode: primaryClaim.claimCode },
      }));
      assert.equal(replayClaim.response.status, 409);
      console.error("[device-cert] stage:claim-primary-replay-passed");

      console.error("[device-cert] stage:claim-concurrent-issue");
      const concurrentClaim = await runStage("claim.concurrent.issue", () => issueClaim(concurrent), 25_000);
      console.error("[device-cert] stage:claim-concurrent-redemption");
      const concurrentResults = await runStage("claim.concurrent.redemption", () => Promise.all([
        api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: concurrent.publicDeviceUuid, venueId: owner.venueId, claimCode: concurrentClaim.claimCode } }),
        api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: concurrent.publicDeviceUuid, venueId: owner.venueId, claimCode: concurrentClaim.claimCode } }),
      ]), 30_000);
      assert.deepEqual(concurrentResults.map((result) => result.response.status).sort(), [200, 409]);
      const concurrentAssignments = await runStage("claim.concurrent.assignment-count", () => db.select().from(nightlyDeviceAssignments).where(and(eq(nightlyDeviceAssignments.deviceId, concurrent.id), eq(nightlyDeviceAssignments.status, "active"))));
      assert.equal(concurrentAssignments.length, 1);
      console.error("[device-cert] competing claim redemptions yielded one winner");

      console.error("[device-cert] stage:claim-edge-cross-venue");
      const edgeClaim = await runStage("claim.edge.issue", () => issueClaim(third), 25_000);
      const foreignVenueAttempt = await runStage("claim.edge.cross-venue", () => api("/api/device/v1/claim", {
        token: otherOwnerToken!,
        body: { publicDeviceUuid: third.publicDeviceUuid, venueId: otherOwner.venueId, claimCode: edgeClaim.claimCode },
      }));
      assert.equal(foreignVenueAttempt.response.status, 400);
      const [unconsumedEdgeClaim] = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, edgeClaim.claim.id)).limit(1);
      assert.equal(unconsumedEdgeClaim?.status, "pending");

      const expiredCode = randomBytes(32).toString("base64url");
      const revokedCode = randomBytes(32).toString("base64url");
      const [expiredRow] = await runStage("claim.edge.create-expired-fixture", () => db.insert(nightlyDeviceClaims).values({
        deviceId: third.id,
        venueId: owner.venueId,
        claimantClerkUserId: owner.clerkUserId,
        claimCodeHash: deviceAuth.hashDeviceSecret(expiredCode),
        status: "pending",
        expiresAt: new Date(Date.now() - 60_000),
      }).returning({ id: nightlyDeviceClaims.id }));
      const [revokedRow] = await runStage("claim.edge.create-revoked-fixture", () => db.insert(nightlyDeviceClaims).values({
        deviceId: third.id,
        venueId: owner.venueId,
        claimantClerkUserId: owner.clerkUserId,
        claimCodeHash: deviceAuth.hashDeviceSecret(revokedCode),
        status: "revoked",
        revokedAt: new Date(),
      }).returning({ id: nightlyDeviceClaims.id }));
      console.error("[device-cert] stage:claim-edge-expired-revoked");
      const expiredAttempt = await api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: third.publicDeviceUuid, venueId: owner.venueId, claimCode: expiredCode } });
      const revokedAttempt = await api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: third.publicDeviceUuid, venueId: owner.venueId, claimCode: revokedCode } });
      assert.equal(expiredAttempt.response.status, 400);
      assert.equal(revokedAttempt.response.status, 400);
      const expiredState = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, expiredRow.id)).limit(1);
      const revokedState = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, revokedRow.id)).limit(1);
      assert.equal(expiredState[0]?.usedAt, null);
      assert.equal(revokedState[0]?.usedAt, null);

      console.error("[device-cert] stage:commissioning-db-baseline");
      const allCommissioning = policy.COMMISSIONING_CHECKS;
      await runStage("commissioning.seed-not-tested", () => db.insert(nightlyDeviceCommissioningChecks).values(allCommissioning.map((checkKey) => ({ deviceId: primary.id, checkKey, status: "not_tested" as const }))));
      const checks = await runStage("commissioning.read-not-tested", () => db.select().from(nightlyDeviceCommissioningChecks).where(eq(nightlyDeviceCommissioningChecks.deviceId, primary.id)));
      assert.equal(checks.length, allCommissioning.length);
      assert.ok(checks.every((check) => check.status === "not_tested" && check.checkedAt === null));
      assert.equal(policy.normalizeCommissioningStatus(undefined), "not_tested");
      for (const status of ["pass", "warning", "fail"] as const) {
        await assert.rejects(db.update(nightlyDeviceCommissioningChecks).set({ status, updatedAt: new Date() }).where(and(eq(nightlyDeviceCommissioningChecks.deviceId, primary.id), eq(nightlyDeviceCommissioningChecks.checkKey, "cameras"))));
      }

      const [cameraA] = await db.insert(venueCameras).values({
        venueId: owner.venueId,
        name: `${fixturePrefix}-camera-a`,
        streamUrl: `https://${fixturePrefix.toLowerCase()}.invalid/private-stream`,
        streamType: "hls",
        status: "disabled",
        isPrimary: false,
        publicPlaybackEnabled: false,
      }).returning({ id: venueCameras.id, venueId: venueCameras.venueId });
      const [cameraB] = await db.insert(venueCameras).values({
        venueId: otherOwner.venueId,
        name: `${fixturePrefix}-camera-b`,
        streamUrl: `https://${fixturePrefix.toLowerCase()}.invalid/other-private-stream`,
        streamType: "hls",
        status: "disabled",
        isPrimary: false,
        publicPlaybackEnabled: false,
      }).returning({ id: venueCameras.id, venueId: venueCameras.venueId });

      await assert.rejects(db.insert(nightlyDeviceSources).values({
        deviceId: primary.id,
        venueId: owner.venueId,
        sourceType: "ip_camera",
        sourceLabel: `${fixturePrefix}-invalid-camera`,
      }));
      await assert.rejects(db.insert(nightlyDeviceSources).values({
        deviceId: primary.id,
        venueId: otherOwner.venueId,
        sourceType: "hdmi_input",
        sourceLabel: `${fixturePrefix}-cross-venue-device`,
      }));
      await assert.rejects(db.insert(nightlyDeviceSources).values({
        deviceId: primary.id,
        venueId: owner.venueId,
        sourceType: "ip_camera",
        sourceLabel: `${fixturePrefix}-cross-venue-camera`,
        venueCameraId: cameraB.id,
      }));

      await db.insert(nightlyDeviceSources).values([
        { deviceId: primary.id, venueId: owner.venueId, sourceType: "ip_camera", sourceLabel: `${fixturePrefix}-camera`, venueCameraId: cameraA.id },
        { deviceId: primary.id, venueId: owner.venueId, sourceType: "hdmi_input", sourceLabel: `${fixturePrefix}-hdmi` },
        { deviceId: primary.id, venueId: owner.venueId, sourceType: "mixer_audio", sourceLabel: `${fixturePrefix}-mixer` },
        { deviceId: primary.id, venueId: owner.venueId, sourceType: "ambient_audio", sourceLabel: `${fixturePrefix}-ambient` },
        { deviceId: primary.id, venueId: owner.venueId, sourceType: "other", sourceLabel: `${fixturePrefix}-other` },
      ]);
      await assert.rejects(db.insert(nightlyDeviceSources).values({
        deviceId: concurrent.id,
        venueId: owner.venueId,
        sourceType: "ip_camera",
        sourceLabel: `${fixturePrefix}-duplicate-camera`,
        venueCameraId: cameraA.id,
      }));

      await db.update(nightlyDevices).set({
        lifecycleState: "active",
        claimState: "claimed",
        serviceEntitlementState: "suspended",
        serviceSuspendedAt: new Date(),
        managementRecoveryEligible: true,
        desiredConfigRevision: `${fixturePrefix}-config-1`,
        operationalState: "starting",
        updatedAt: new Date(),
      }).where(eq(nightlyDevices.id, primary.id));
      assert.equal(await deviceAuth.canUseDeviceForService(primary.id), false);
      assert.equal(await deviceAuth.canUseDeviceForManagement(primary.id), true);

      const statusNoClerk = await api("/api/device/v1/status", { method: "POST", token: undefined });
      assert.equal(statusNoClerk.response.status, 401);
      const statusWithDevice = await deviceFetch(`${apiBase}/api/device/v1/status`, { method: "POST", headers: primaryHeaders, cache: "no-store" });
      assert.equal(statusWithDevice.status, 200);
      const statusPayload = await statusWithDevice.json() as ApiPayload;
      assert.equal(statusPayload.device?.serviceEntitlementState, "suspended");
      assert.equal(statusPayload.device?.managementAccessLevel, "owner_assisted");
      assert.equal(JSON.stringify(statusPayload).includes(primary.deviceSecret), false);

      const heartbeat = await deviceFetch(`${apiBase}/api/device/v1/heartbeat`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ agentVersion: "0.1.0-cert", softwareVersion: "box-image-cert", operationalState: "degraded" }),
        cache: "no-store",
      });
      assert.equal(heartbeat.status, 200);
      const [afterHeartbeat] = await db.select().from(nightlyDevices).where(eq(nightlyDevices.id, primary.id)).limit(1);
      assert.ok(afterHeartbeat.lastHeartbeatAt);
      assert.equal(afterHeartbeat.operationalState, "degraded");
      assert.equal(afterHeartbeat.serviceEntitlementState, "suspended");
      assert.equal(afterHeartbeat.agentVersion, "0.1.0-cert");
      assert.equal(afterHeartbeat.softwareVersion, "box-image-cert");

      const invalidCapabilities = await deviceFetch(`${apiBase}/api/device/v1/capabilities`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ capabilities: [{ category: "hdmi_input", name: "mode", value: "1080p", supported: true, metadata: { apiKey: "do-not-store" } }] }),
      });
      assert.equal(invalidCapabilities.status, 400);
      const validCapabilities = [
        { category: "hdmi_input", name: "mode", value: "1080p60", supported: true },
        { category: "secure_boot", name: "enabled", value: true, supported: true },
      ];
      const capabilityResponse = await deviceFetch(`${apiBase}/api/device/v1/capabilities`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ capabilities: validCapabilities }),
      });
      assert.equal(capabilityResponse.status, 200);
      let persistedCapabilities = await db.select().from(nightlyDeviceCapabilities).where(eq(nightlyDeviceCapabilities.deviceId, primary.id));
      assert.equal(persistedCapabilities.length, 2);
      const replacementResponse = await deviceFetch(`${apiBase}/api/device/v1/capabilities`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ capabilities: [{ category: "ethernet", name: "lan_count", value: 2, supported: true }] }),
      });
      assert.equal(replacementResponse.status, 200);
      persistedCapabilities = await db.select().from(nightlyDeviceCapabilities).where(eq(nightlyDeviceCapabilities.deviceId, primary.id));
      assert.equal(persistedCapabilities.length, 1);
      assert.equal(persistedCapabilities[0]?.category, "ethernet");

      const configResponse = await deviceFetch(`${apiBase}/api/device/v1/config`, { headers: primaryHeaders, cache: "no-store" });
      assert.equal(configResponse.status, 200);
      const configPayload = await configResponse.json() as ApiPayload;
      assert.equal(configPayload.configRevision, `${fixturePrefix}-config-1`);
      assert.equal(configPayload.sections?.privacy?.mode, "private");
      assert.equal(configPayload.sections?.recovery?.enabled, true);
      assert.equal(JSON.stringify(configPayload).includes(primary.deviceSecret), false);
      const ackResponse = await deviceFetch(`${apiBase}/api/device/v1/config`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ configRevision: `${fixturePrefix}-config-1` }),
      });
      assert.equal(ackResponse.status, 200);
      const staleAck = await deviceFetch(`${apiBase}/api/device/v1/config`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ configRevision: `${fixturePrefix}-stale` }),
      });
      assert.equal(staleAck.status, 409);
      const inventory = await deviceFetch(`${apiBase}/api/device/v1/inventory`, { headers: primaryHeaders, cache: "no-store" });
      assert.equal(inventory.status, 200);
      const inventoryPayload = await inventory.json() as ApiPayload;
      assert.equal(inventoryPayload.sources?.length, 5);
      assert.equal(JSON.stringify(inventoryPayload).includes("private-stream"), false);
      assert.equal(JSON.stringify(inventoryPayload).includes(primary.deviceSecret), false);

      const unsafeInventory = await deviceFetch(`${apiBase}/api/device/v1/inventory`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ sources: [{ sourceType: "hdmi_input", sourceLabel: "capture-card", evidence: { token: "must-not-store" } }] }),
      });
      assert.equal(unsafeInventory.status, 400);
      const unownedInventory = await deviceFetch(`${apiBase}/api/device/v1/inventory`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ sources: [{ sourceType: "hdmi_input", sourceLabel: "venue-managed-label" }] }),
      });
      assert.equal(unownedInventory.status, 400);
      const duplicateCanonicalCamera = await deviceFetch(`${apiBase}/api/device/v1/inventory`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ sources: [{ sourceType: "ip_camera", sourceLabel: "agent:canonical-camera", venueCameraId: cameraA.id, evidence: { availability: "DETECTED" } }] }),
      });
      await assertResponseStatus("inventory.duplicate-camera.expected-409", duplicateCanonicalCamera, 409);
      await runStage("inventory.duplicate-camera.preservation", async () => {
        const canonicalMappingAfterConflict = await db.select().from(nightlyDeviceSources).where(eq(nightlyDeviceSources.venueCameraId, cameraA.id));
        assert.equal(canonicalMappingAfterConflict.length, 1);
        assert.equal(canonicalMappingAfterConflict[0]?.deviceId, primary.id);
        assert.equal(canonicalMappingAfterConflict[0]?.venueId, owner.venueId);
        assert.equal(canonicalMappingAfterConflict[0]?.sourceLabel, `${fixturePrefix}-camera`);
        assert.equal(canonicalMappingAfterConflict[0]?.sourceLabel.startsWith("agent:"), false);
      });
      const crossVenueCamera = await deviceFetch(`${apiBase}/api/device/v1/inventory`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ sources: [{ sourceType: "ip_camera", sourceLabel: "agent:foreign-camera", venueCameraId: cameraB.id }] }),
      });
      assert.equal(crossVenueCamera.status, 400);
      const sourceReport = await deviceFetch(`${apiBase}/api/device/v1/inventory`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ sources: [
          { sourceType: "hdmi_input", sourceLabel: "agent:capture-card", evidence: { availability: "NOT_TESTED" } },
          { sourceType: "ambient_audio", sourceLabel: "agent:alsa", evidence: { availability: "DETECTED" } },
        ] }),
      });
      assert.equal(sourceReport.status, 200);
      const persistedSources = await db.select().from(nightlyDeviceSources).where(eq(nightlyDeviceSources.deviceId, primary.id));
      assert.equal(persistedSources.length, 7);
      assert.ok(persistedSources.every((source) => source.venueId === owner.venueId));
      assert.equal(JSON.stringify(persistedSources).includes("must-not-store"), false);
      assert.equal(persistedSources.filter((source) => source.sourceLabel.startsWith("agent:")).length, 2);

      const unsafeCommissioning = await deviceFetch(`${apiBase}/api/device/v1/commissioning`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ checks: [{ checkKey: "cameras", status: "pass", summary: "detected", checkedAt: new Date().toISOString(), evidence: { password: "must-not-store" } }] }),
      });
      assert.equal(unsafeCommissioning.status, 400);
      const simulatedPass = await deviceFetch(`${apiBase}/api/device/v1/commissioning`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ checks: [{ checkKey: "cameras", status: "pass", summary: "SIMULATED: camera detected", checkedAt: new Date().toISOString(), evidence: { simulated: true } }] }),
      });
      assert.equal(simulatedPass.status, 400);
      const commissioningReport = await deviceFetch(`${apiBase}/api/device/v1/commissioning`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ checks: [{ checkKey: "cameras", status: "pass", summary: "Local camera device detected.", checkedAt: new Date().toISOString(), evidence: { availability: "SUPPORTED", deviceCount: 1 } }] }),
      });
      assert.equal(commissioningReport.status, 200);
      const persistedCommissioning = await db.select().from(nightlyDeviceCommissioningChecks).where(and(eq(nightlyDeviceCommissioningChecks.deviceId, primary.id), eq(nightlyDeviceCommissioningChecks.checkKey, "cameras"))).limit(1);
      assert.equal(persistedCommissioning[0]?.status, "pass");
      assert.equal(persistedCommissioning[0]?.summary, "Local camera device detected.");

      await db.update(nightlyDevices).set({ managementAccessLevel: "recovery_only", updatedAt: new Date() }).where(eq(nightlyDevices.id, primary.id));
      const recoveryStatus = await deviceFetch(`${apiBase}/api/device/v1/status`, { method: "POST", headers: primaryHeaders, cache: "no-store" });
      assert.equal(recoveryStatus.status, 200);
      const recoveryInventory = await deviceFetch(`${apiBase}/api/device/v1/inventory`, { headers: primaryHeaders, cache: "no-store" });
      assert.equal(recoveryInventory.status, 200);
      const recoveryConfig = await deviceFetch(`${apiBase}/api/device/v1/config`, { headers: primaryHeaders, cache: "no-store" });
      assert.equal(recoveryConfig.status, 403);
      const recoveryCapabilities = await deviceFetch(`${apiBase}/api/device/v1/capabilities`, {
        method: "POST",
        headers: { ...primaryHeaders, "content-type": "application/json" },
        body: JSON.stringify({ capabilities: [{ category: "ethernet", name: "lan_count", value: 1, supported: true }] }),
      });
      assert.equal(recoveryCapabilities.status, 403);
      await db.update(nightlyDevices).set({ managementAccessLevel: "disabled", updatedAt: new Date() }).where(eq(nightlyDevices.id, primary.id));
      const disabledStatus = await deviceFetch(`${apiBase}/api/device/v1/status`, { method: "POST", headers: primaryHeaders, cache: "no-store" });
      assert.equal(disabledStatus.status, 403);

      await db.update(nightlyDevices).set({ lifecycleState: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(eq(nightlyDevices.id, third.id));
      const revokedResponse = await deviceFetch(`${apiBase}/api/device/v1/status`, { method: "POST", headers: { authorization: `Bearer ${third.deviceSecret}`, "x-nightly-device-uuid": third.publicDeviceUuid }, cache: "no-store" });
      assert.equal(revokedResponse.status, 403);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_failure";
      const stageMatch = message.match(/^Certification stage failed: ([a-zA-Z0-9._-]+)/);
      bodyFailure = stageMatch?.[1] ?? activeStageName ?? "assertions";
      throw error;
    } finally {
      clearTimeout(overallTimer);
      let cleanupComplete = true;
      if (!clerk && manifestStore.value.sessionIds.length > 0) cleanupComplete = false;
      if (developmentIdentityVerified) {
        try {
          await runStage("cleanup.database-fixtures", async () => {
            const deviceRows = await db.select({ id: nightlyDevices.id }).from(nightlyDevices).where(like(nightlyDevices.serialNumber, `${fixturePrefix}%`));
            const deviceIds = deviceRows.map((row) => row.id);
            if (deviceIds.length) {
              await db.delete(auditLogs).where(and(eq(auditLogs.entityType, "nightly_device"), inArray(auditLogs.entityId, deviceIds.map(String))));
              await db.delete(nightlyDevices).where(inArray(nightlyDevices.id, deviceIds));
            }
            await db.delete(venueCameras).where(like(venueCameras.name, `${fixturePrefix}%`));
            await db.delete(venueStaffProfiles).where(and(
              eq(venueStaffProfiles.firstName, "Nightly"),
              eq(venueStaffProfiles.lastName, "Certification Operator"),
              eq(venueStaffProfiles.jobTitle, "Tech Operator Certification Fixture"),
              like(venueStaffProfiles.email, `${fixturePrefix.toLowerCase()}%@invalid.example`),
            ));
            const [remainingDevice] = await db.select({ id: nightlyDevices.id }).from(nightlyDevices).where(like(nightlyDevices.serialNumber, `${fixturePrefix}%`)).limit(1);
            const [remainingCamera] = await db.select({ id: venueCameras.id }).from(venueCameras).where(like(venueCameras.name, `${fixturePrefix}%`)).limit(1);
            const [remainingOperator] = await db.select({ id: venueStaffProfiles.id }).from(venueStaffProfiles).where(and(
              eq(venueStaffProfiles.firstName, "Nightly"),
              eq(venueStaffProfiles.lastName, "Certification Operator"),
              eq(venueStaffProfiles.jobTitle, "Tech Operator Certification Fixture"),
              like(venueStaffProfiles.email, `${fixturePrefix.toLowerCase()}%@invalid.example`),
            )).limit(1);
            if (remainingDevice || remainingCamera || remainingOperator) throw new Error("Certification DB fixture cleanup verification failed.");
          }, 25_000);
          const recordedDeviceIds = manifestStore.value.deviceIds;
          const [remainingDevices, remainingClaims, remainingAssignments, remainingCapabilities, remainingSources, remainingCommissioning, remainingAudits, remainingCameras, remainingOperators] = await Promise.all([
            db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(nightlyDevices).where(like(nightlyDevices.serialNumber, `${fixturePrefix}%`)),
            recordedDeviceIds.length ? db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(nightlyDeviceClaims).where(inArray(nightlyDeviceClaims.deviceId, recordedDeviceIds)) : Promise.resolve([{ count: 0 }]),
            recordedDeviceIds.length ? db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(nightlyDeviceAssignments).where(inArray(nightlyDeviceAssignments.deviceId, recordedDeviceIds)) : Promise.resolve([{ count: 0 }]),
            recordedDeviceIds.length ? db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(nightlyDeviceCapabilities).where(inArray(nightlyDeviceCapabilities.deviceId, recordedDeviceIds)) : Promise.resolve([{ count: 0 }]),
            recordedDeviceIds.length ? db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(nightlyDeviceSources).where(inArray(nightlyDeviceSources.deviceId, recordedDeviceIds)) : Promise.resolve([{ count: 0 }]),
            recordedDeviceIds.length ? db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(nightlyDeviceCommissioningChecks).where(inArray(nightlyDeviceCommissioningChecks.deviceId, recordedDeviceIds)) : Promise.resolve([{ count: 0 }]),
            recordedDeviceIds.length ? db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(auditLogs).where(and(eq(auditLogs.entityType, "nightly_device"), inArray(auditLogs.entityId, recordedDeviceIds.map(String)))) : Promise.resolve([{ count: 0 }]),
            db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(venueCameras).where(like(venueCameras.name, `${fixturePrefix}%`)),
            db.select({ count: drizzleOrm.sql<number>`count(*)::int` }).from(venueStaffProfiles).where(and(
            eq(venueStaffProfiles.firstName, "Nightly"),
            eq(venueStaffProfiles.lastName, "Certification Operator"),
            eq(venueStaffProfiles.jobTitle, "Tech Operator Certification Fixture"),
            like(venueStaffProfiles.email, `${fixturePrefix.toLowerCase()}%@invalid.example`),
            )),
          ]);
          remainingFixtureCount = [remainingDevices, remainingClaims, remainingAssignments, remainingCapabilities, remainingSources, remainingCommissioning, remainingAudits, remainingCameras, remainingOperators]
            .reduce((total, rows) => total + Number(rows[0]?.count ?? 0), 0);
          databaseCleanupStatus = remainingFixtureCount === 0 ? "PASS" : "FAIL";
          await resultStore.setDatabaseCleanup(databaseCleanupStatus, remainingFixtureCount);
        } catch {
          cleanupComplete = false;
          databaseCleanupStatus = "FAIL";
          await resultStore.setDatabaseCleanup("FAIL", null);
        }
      } else {
        await resultStore.setDatabaseCleanup("NOT_RUN", null);
      }

      const failedSessionIds: string[] = [];
      for (const sessionId of manifestStore.value.sessionIds) {
        try {
          if (clerk) await runStage("cleanup.clerk-session", () => clerk.sessions.revokeSession(sessionId), 15_000);
        } catch {
          cleanupComplete = false;
          failedSessionIds.push(sessionId);
        }
      }
      if (manifestStore.value.pendingSessionUserId) cleanupComplete = false;
      remainingKnownSessionCount = manifestStore.value.pendingSessionUserId === null ? failedSessionIds.length : null;
      clerkCleanupStatus = failedSessionIds.length === 0 && manifestStore.value.pendingSessionUserId === null ? "PASS" : "FAIL";
      await resultStore.setClerkCleanup(clerkCleanupStatus, remainingKnownSessionCount);
      try { await runStage("cleanup.database-pool-close", () => pool.end(), 8_000); } catch { cleanupComplete = false; }
      if (cleanupComplete) await manifestStore.remove();
      else console.error(`[device-cert] cleanup:incomplete run=${manifestStore.value.runId} recovery=cleanup-nightly-device-certification`);
      const canPass = bodyFailure === null && cleanupComplete && developmentIdentityVerified && databaseCleanupStatus === "PASS" && remainingFixtureCount === 0 && clerkCleanupStatus === "PASS" && remainingKnownSessionCount === 0;
      const timeoutOccurred = (activeTerminalStatus as "FAIL" | "TIMEOUT") === "TIMEOUT";
      const finalStatus = canPass ? "PASS" : timeoutOccurred ? "TIMEOUT" : "FAIL";
      const failedStage = canPass ? null : bodyFailure ?? (cleanupComplete ? activeStageName ?? "assertions" : "cleanup");
      await resultStore.finish(finalStatus, failedStage);
      activeResultStore = null;
      if (!cleanupComplete) throw new Error("Certification cleanup incomplete; inspect the private OS-temp manifest.");
    }
  }
);
