import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";

if (process.env.NIGHTLY_DEVICE_API_CERTIFICATION === "true") {
  config({ path: ".env.local", override: true, quiet: true });
}

type ApiPayload = {
  device?: {
    id?: number;
    publicDeviceUuid?: string;
    serialNumber?: string;
    serviceEntitlementState?: string;
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

test(
  "Nightly device v1 API and persistence certify against Development",
  { skip: process.env.NIGHTLY_DEVICE_API_CERTIFICATION !== "true" },
  async () => {
    const [dbModule, drizzleOrm, schema, clerkServer, deviceAuth, policy] = await Promise.all([
      import("../db"),
      import("drizzle-orm"),
      import("../db/schema"),
      import("@clerk/nextjs/server"),
      import("../lib/nightly-device/auth"),
      import("../lib/nightly-device/policy"),
    ]);
    const { db } = dbModule;
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
    const apiBase = process.env.NIGHTLY_CERT_BASE_URL ?? "http://localhost:3100";
    const fixturePrefix = `NIGHTLY-SPRINT1-CERT-${randomUUID()}`;
    const ownerProfileIds: number[] = [];
    const cameraIds: number[] = [];
    const sessionIds: string[] = [];
    const clerk = await clerkServer.clerkClient();

    async function sessionFor(clerkUserId: string) {
      const session = await clerk.sessions.createSession({ userId: clerkUserId });
      sessionIds.push(session.id);
      const token = await clerk.sessions.getToken(session.id);
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

    async function deviceFetch(url: string, init: RequestInit = {}) {
      return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    }

    const createdDevices: Array<{ id: number; publicDeviceUuid: string; serialNumber: string; deviceSecret: string }> = [];
    let adminToken: string | null = null;
    let ownerToken: string | null = null;
    let otherOwnerToken: string | null = null;
    let techToken: string | null = null;

    try {
      const { config: databaseConfig } = await import("dotenv");
      databaseConfig({ path: ".env.local", override: true, quiet: true });
      const url = new URL(process.env.DATABASE_URL ?? "");
      const identityResult = await db.execute(drizzleOrm.sql.raw(
        "select current_database() as database_name,current_setting('neon.project_id',true) as project_id,current_setting('neon.branch_id',true) as branch_id,current_setting('neon.endpoint_id',true) as endpoint_id"
      ));
      const identity = identityResult.rows[0];
      assert.equal(url.hostname.startsWith("ep-silent-hat-"), true);
      assert.equal(identity?.project_id, "old-tooth-16761666");
      assert.equal(identity?.branch_id, "br-tiny-recipe-atpyb85n");
      assert.equal(identity?.endpoint_id, "ep-silent-hat-at3rhpgq");
      assert.equal(identity?.database_name, "neondb");

      const [admin] = await db
        .select({ clerkUserId: users.clerkUserId })
        .from(users)
        .innerJoin(adminAssignments, eq(adminAssignments.clerkUserId, users.clerkUserId))
        .where(and(
          eq(users.role, "admin"),
          eq(users.accountStatus, "active"),
          eq(adminAssignments.status, "active"),
          or(isNull(adminAssignments.expiresAt), gt(adminAssignments.expiresAt, new Date()))
        ))
        .limit(1);
      const owners = await db
        .select({ clerkUserId: users.clerkUserId, venueId: venueMembers.venueId })
        .from(venueMembers)
        .innerJoin(users, eq(users.clerkUserId, venueMembers.clerkUserId))
        .where(eq(venueMembers.role, "owner"))
        .orderBy(asc(venueMembers.venueId));
      const owner = owners[0];
      const otherOwner = owners.find((candidate) => candidate.venueId !== owner?.venueId && candidate.clerkUserId !== owner.clerkUserId);
      assert.ok(admin?.clerkUserId, "Development admin actor is unavailable.");
      assert.ok(owner?.clerkUserId, "Development venue owner actor is unavailable.");
      assert.ok(otherOwner?.clerkUserId, "A distinct second owner is required for cross-venue certification.");

      adminToken = await sessionFor(admin.clerkUserId);
      ownerToken = await sessionFor(owner.clerkUserId);
      otherOwnerToken = await sessionFor(otherOwner.clerkUserId);

      const consumers = await db
        .select({ clerkUserId: users.clerkUserId })
        .from(users)
        .where(and(eq(users.role, "consumer"), eq(users.accountStatus, "active")))
        .limit(20);
      let techUserId: string | null = null;
      for (const consumer of consumers) {
        try {
          await clerk.users.getUser(consumer.clerkUserId);
          techUserId = consumer.clerkUserId;
          break;
        } catch {
          continue;
        }
      }
      assert.ok(techUserId, "A Development Clerk consumer identity is required for Tech Operator certification.");
      techToken = await sessionFor(techUserId);
      const [techProfile] = await db.insert(venueStaffProfiles).values({
        venueId: owner.venueId,
        clerkUserId: techUserId,
        firstName: "Nightly",
        lastName: "Certification Operator",
        email: `${fixturePrefix.toLowerCase()}@invalid.example`,
        department: "operations",
        jobTitle: "Tech Operator Certification Fixture",
        permissionsJson: JSON.stringify(["nightly_device:operate"]),
        status: "active",
      }).returning({ id: venueStaffProfiles.id });
      ownerProfileIds.push(techProfile.id);

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
      const [claimedDevice] = await db.select().from(nightlyDevices).where(eq(nightlyDevices.id, primary.id)).limit(1);
      assert.equal(claimedDevice.venueId, owner.venueId);
      assert.equal(claimedDevice.lifecycleState, "claimed");
      assert.equal(claimedDevice.claimState, "claimed");
      const assignments = await db.select().from(nightlyDeviceAssignments).where(and(eq(nightlyDeviceAssignments.deviceId, primary.id), eq(nightlyDeviceAssignments.status, "active")));
      assert.equal(assignments.length, 1);
      const [consumedClaim] = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, primaryClaim.claim.id)).limit(1);
      assert.ok(consumedClaim?.usedAt);
      assert.equal(consumedClaim?.status, "claimed");
      const replayClaim = await api("/api/device/v1/claim", {
        token: ownerToken!,
        body: { publicDeviceUuid: primary.publicDeviceUuid, venueId: owner.venueId, claimCode: primaryClaim.claimCode },
      });
      assert.equal(replayClaim.response.status, 409);

      const concurrentClaim = await issueClaim(concurrent);
      const concurrentResults = await Promise.all([
        api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: concurrent.publicDeviceUuid, venueId: owner.venueId, claimCode: concurrentClaim.claimCode } }),
        api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: concurrent.publicDeviceUuid, venueId: owner.venueId, claimCode: concurrentClaim.claimCode } }),
      ]);
      assert.deepEqual(concurrentResults.map((result) => result.response.status).sort(), [200, 409]);
      const concurrentAssignments = await db.select().from(nightlyDeviceAssignments).where(and(eq(nightlyDeviceAssignments.deviceId, concurrent.id), eq(nightlyDeviceAssignments.status, "active")));
      assert.equal(concurrentAssignments.length, 1);
      console.error("[device-cert] competing claim redemptions yielded one winner");

      const edgeClaim = await issueClaim(third);
      const foreignVenueAttempt = await api("/api/device/v1/claim", {
        token: otherOwnerToken!,
        body: { publicDeviceUuid: third.publicDeviceUuid, venueId: otherOwner.venueId, claimCode: edgeClaim.claimCode },
      });
      assert.equal(foreignVenueAttempt.response.status, 400);
      const [unconsumedEdgeClaim] = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, edgeClaim.claim.id)).limit(1);
      assert.equal(unconsumedEdgeClaim?.status, "pending");

      const expiredCode = randomBytes(32).toString("base64url");
      const revokedCode = randomBytes(32).toString("base64url");
      const [expiredRow] = await db.insert(nightlyDeviceClaims).values({
        deviceId: third.id,
        venueId: owner.venueId,
        claimantClerkUserId: owner.clerkUserId,
        claimCodeHash: deviceAuth.hashDeviceSecret(expiredCode),
        status: "pending",
        expiresAt: new Date(Date.now() - 60_000),
      }).returning({ id: nightlyDeviceClaims.id });
      const [revokedRow] = await db.insert(nightlyDeviceClaims).values({
        deviceId: third.id,
        venueId: owner.venueId,
        claimantClerkUserId: owner.clerkUserId,
        claimCodeHash: deviceAuth.hashDeviceSecret(revokedCode),
        status: "revoked",
        revokedAt: new Date(),
      }).returning({ id: nightlyDeviceClaims.id });
      const expiredAttempt = await api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: third.publicDeviceUuid, venueId: owner.venueId, claimCode: expiredCode } });
      const revokedAttempt = await api("/api/device/v1/claim", { token: ownerToken!, body: { publicDeviceUuid: third.publicDeviceUuid, venueId: owner.venueId, claimCode: revokedCode } });
      assert.equal(expiredAttempt.response.status, 400);
      assert.equal(revokedAttempt.response.status, 400);
      const expiredState = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, expiredRow.id)).limit(1);
      const revokedState = await db.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, revokedRow.id)).limit(1);
      assert.equal(expiredState[0]?.usedAt, null);
      assert.equal(revokedState[0]?.usedAt, null);

      const allCommissioning = policy.COMMISSIONING_CHECKS;
      await db.insert(nightlyDeviceCommissioningChecks).values(allCommissioning.map((checkKey) => ({ deviceId: primary.id, checkKey, status: "not_tested" as const })));
      const checks = await db.select().from(nightlyDeviceCommissioningChecks).where(eq(nightlyDeviceCommissioningChecks.deviceId, primary.id));
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
      cameraIds.push(cameraA.id);
      const [cameraB] = await db.insert(venueCameras).values({
        venueId: otherOwner.venueId,
        name: `${fixturePrefix}-camera-b`,
        streamUrl: `https://${fixturePrefix.toLowerCase()}.invalid/other-private-stream`,
        streamType: "hls",
        status: "disabled",
        isPrimary: false,
        publicPlaybackEnabled: false,
      }).returning({ id: venueCameras.id, venueId: venueCameras.venueId });
      cameraIds.push(cameraB.id);

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
      assert.equal(JSON.stringify(statusPayload).includes(primary.deviceSecret), false);

      const heartbeat = await deviceFetch(`${apiBase}/api/device/v1/heartbeat`, { method: "POST", headers: primaryHeaders, cache: "no-store" });
      assert.equal(heartbeat.status, 200);
      const [afterHeartbeat] = await db.select().from(nightlyDevices).where(eq(nightlyDevices.id, primary.id)).limit(1);
      assert.ok(afterHeartbeat.lastHeartbeatAt);
      assert.equal(afterHeartbeat.operationalState, "healthy");
      assert.equal(afterHeartbeat.serviceEntitlementState, "suspended");

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
    } finally {
      const deviceRows = await db.select({ id: nightlyDevices.id }).from(nightlyDevices).where(like(nightlyDevices.serialNumber, `${fixturePrefix}%`));
      const deviceIds = deviceRows.map((row) => row.id);
      if (deviceIds.length) {
        await db.delete(auditLogs).where(and(eq(auditLogs.entityType, "nightly_device"), inArray(auditLogs.entityId, deviceIds.map(String))));
        await db.delete(nightlyDevices).where(inArray(nightlyDevices.id, deviceIds));
      }
      if (cameraIds.length) await db.delete(venueCameras).where(inArray(venueCameras.id, cameraIds));
      if (ownerProfileIds.length) await db.delete(venueStaffProfiles).where(inArray(venueStaffProfiles.id, ownerProfileIds));
      for (const sessionId of sessionIds) await clerk.sessions.revokeSession(sessionId).catch(() => undefined);
    }
  }
);
