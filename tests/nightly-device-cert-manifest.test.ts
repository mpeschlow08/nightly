import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CertificationManifestStore } from "./helpers/nightly-device-cert-manifest";
import { developmentDatabaseIdentityFailure } from "./helpers/development-db-identity";
import { CertificationResultStore, normalizeCertificationStageName } from "./helpers/certification-result";

test("certification manifest durably records fixture prefix and exact session IDs without tokens", async () => {
  const manifest = await CertificationManifestStore.create();
  try {
    await manifest.beginSession("user_development_fixture");
    await manifest.recordSession("sess_CertificationOwned123");
    const stored = await readFile(manifest.path, "utf8");
    const parsed = await CertificationManifestStore.read(manifest.path);
    assert.equal(parsed.fixturePrefix, `NIGHTLY-SPRINT2-CERT-${parsed.runId}`);
    assert.deepEqual(parsed.sessionIds, ["sess_CertificationOwned123"]);
    assert.equal(parsed.pendingSessionUserId, null);
    assert.equal(stored.includes("jwt"), false);
    assert.equal(stored.includes("secret"), false);
  } finally {
    await manifest.remove();
  }
});

test("Development identity guard accepts only the pinned Development endpoint", () => {
  const development = {
    hostname: "ep-silent-hat-at3rhpgq-pooler.example.neon.tech",
    projectId: "old-tooth-16761666",
    branchId: "br-tiny-recipe-atpyb85n",
    endpointId: "ep-silent-hat-at3rhpgq",
    databaseName: "neondb",
  };
  assert.equal(developmentDatabaseIdentityFailure(development), null);
  assert.equal(developmentDatabaseIdentityFailure({ ...development, endpointId: "ep-rough-mud-atcx5jvx" }), "production_endpoint_forbidden");
  assert.equal(developmentDatabaseIdentityFailure({ ...development, branchId: "br-dry-dew-at2z1st2" }), "production_branch_forbidden");
  assert.equal(developmentDatabaseIdentityFailure({ ...development, hostname: "ep-rough-mud-atcx5jvx.example.neon.tech" }), "hostname_mismatch");
});

test("durable result artifacts atomically record PASS, FAIL, TIMEOUT and safe fields only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-cert-result-test-"));
  try {
    const runIds = [
      "1790569999999-957f0708-ad47-4b6d-9065-b196f1a4fd93",
      "1790570000000-957f0708-ad47-4b6d-9065-b196f1a4fd93",
      "1790570000001-957f0708-ad47-4b6d-9065-b196f1a4fd93",
    ];
    for (const [index, status] of (["PASS", "FAIL", "TIMEOUT"] as const).entries()) {
      const store = await CertificationResultStore.create(runIds[index]!, directory);
      await store.setDevelopmentIdentityVerified(true);
      await store.stage("identity.select-1", "PASS", 4);
      await store.stage("http./api/device/v1/enroll#1", "PASS", 15);
      await store.setDatabaseCleanup("PASS", 0);
      await store.setClerkCleanup("PASS", 0);
      await store.finish(status, status === "PASS" ? null : "http./api/device/v1/enroll#1");
      const parsed = await store.read();
      assert.equal(parsed.status, status);
      assert.equal(parsed.developmentIdentityVerified, true);
      assert.equal(parsed.databaseCleanup.remainingFixtures, 0);
      assert.equal(parsed.clerkCleanup.remainingKnownSessions, 0);
      assert.equal(parsed.stages[1]?.name, normalizeCertificationStageName("http./api/device/v1/enroll#1"));
      if (status !== "PASS") assert.equal(parsed.failedStage, normalizeCertificationStageName("http./api/device/v1/enroll#1"));
      const text = await readFile(store.path, "utf8");
      assert.equal(/password|bearer|DATABASE_URL|secret|cookie/i.test(text), false);
    }
    const files = await readdir(directory);
    assert.equal(files.length, 3);
    assert.equal(files.some((name) => name.endsWith(".tmp")), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("first failed fixture stage survives later cleanup failure in the durable artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-cert-first-failure-"));
  try {
    const store = await CertificationResultStore.create(`1790579999999-${randomUUID()}`, directory);
    await store.setDevelopmentIdentityVerified(true);
    await store.stage("fixture.device.0", "FAIL", 12);
    assert.equal((await store.read()).failedStage, "fixture.device.0");
    await store.setDatabaseCleanup("FAIL", 1);
    await store.stage("cleanup.database", "FAIL", 4);
    await store.setClerkCleanup("PASS", 0);
    await store.finish("FAIL", "certification.or-cleanup");
    const artifact = await store.read();
    assert.equal(artifact.failedStage, "fixture.device.0");
    assert.equal(artifact.databaseCleanup.status, "FAIL");
    assert.equal(artifact.databaseCleanup.remainingFixtures, 1);
    assert.equal(artifact.clerkCleanup.remainingKnownSessions, 0);
    assert.deepEqual(artifact.stages.map(({ name, status }) => ({ name, status })), [
      { name: "fixture.device.0", status: "FAIL" },
      { name: "cleanup.database", status: "FAIL" },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("media fixture failure retains its stage after successful exact cleanup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-cert-fixture-cleanup-"));
  try {
    const store = await CertificationResultStore.create(`1790580000000-${randomUUID()}`, directory);
    await store.setDevelopmentIdentityVerified(true);
    await store.stage("fixture.device.0", "FAIL", 12);
    await store.setDatabaseCleanup("PASS", 0);
    await store.setClerkCleanup("PASS", 0);
    await store.finish("FAIL", "certification.or-cleanup");
    const artifact = await store.read();
    assert.equal(artifact.status, "FAIL");
    assert.equal(artifact.failedStage, "fixture.device.0");
    assert.deepEqual(artifact.databaseCleanup, { status: "PASS", remainingFixtures: 0 });
    assert.deepEqual(artifact.clerkCleanup, { status: "PASS", remainingKnownSessions: 0 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an unfinished failed-stage artifact never stores a sensitive raw stage name", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nightly-cert-safe-failure-"));
  try {
    const store = await CertificationResultStore.create(`1790580000001-${randomUUID()}`, directory);
    const unsafeStage = "http://localhost:3100/api/device/v1/config?authorization=Bearer%20private-value";
    await store.stage(unsafeStage, "FAIL", 2);
    assert.equal((await store.read()).failedStage, normalizeCertificationStageName(unsafeStage));
    const text = await readFile(store.path, "utf8");
    assert.doesNotMatch(text, /private-value|authorization|Bearer|localhost/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stage names normalize separators deterministically, stay bounded, and redact sensitive values", () => {
  const inputs = [
    "http./api/device/v1/enroll#1",
    "claim?token=private-value",
    "clerk: session create",
    "cleanup////database\\\\fixtures",
    `long.${"segment/".repeat(80)}`,
    "http://localhost:3100/api/device/v1/enroll?authorization=Bearer%20super-secret#7",
    "clerk Bearer abcdefghijklmnopqrstuvwxyz0123456789",
    "cookie=session_token:abcdefghijklmnopqrstuvwxyz0123456789",
    "bootstrapSecret=abcdefghijklmnopqrstuvwxyz0123456789",
    "DATABASE_URL=postgresql://user:password@db.example/neondb",
    "camera=rtsp://operator:camera-password@192.168.1.20/live",
  ];
  const normalized = inputs.map(normalizeCertificationStageName);
  assert.deepEqual(normalized, inputs.map(normalizeCertificationStageName));
  assert.ok(normalized.every((name) => /^[a-z][a-z0-9._-]{0,119}$/.test(name)));
  assert.match(normalized[0]!, /^http\.api\.device\.v1\.enroll\.1\.[a-f0-9]{12}$/);
  assert.notEqual(normalizeCertificationStageName("same/path"), normalizeCertificationStageName("same path"));
  const output = normalized.join(" ");
  for (const forbidden of ["private-value", "super-secret", "abcdefghijklmnopqrstuvwxyz0123456789", "postgresql", "camera-password", "operator"]) {
    assert.equal(output.includes(forbidden), false, `normalized stage leaked ${forbidden}`);
  }
  assert.ok(normalized[4]!.length <= 120);
});