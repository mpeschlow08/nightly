import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import pg from "pg";
import { reconcileOfflineAlertsForDevices } from "../lib/nightly-device/fleet-alerts";

test("Development fleet heartbeat and operation HTTP flow is authenticated and idempotent", { skip: process.env.NIGHTLY_FLEET_CERTIFY_DEVELOPMENT !== "true" }, async () => {
  config({ path: ".env.local", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  const api = new URL(process.env.NIGHTLY_FLEET_API_BASE_URL ?? "");
  assert.ok(url.hostname.includes("ep-silent-hat-at3rhpgq-pooler") && !url.hostname.includes("ep-rough-mud-atcx5jvx"));
  assert.ok(["localhost", "127.0.0.1"].includes(api.hostname) && api.protocol === "http:");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const prefix = `S8_FLEET_${randomUUID().replaceAll("-", "")}`;
  const secretA = randomBytes(32).toString("base64url");
  const secretB = randomBytes(32).toString("base64url");
  const deviceIds: number[] = [];
  async function deviceRequest(uuid: string, secret: string, path: string, method: "GET" | "POST", body?: object) {
    return fetch(new URL(path, api), {
      method,
      headers: { "x-nightly-device-uuid": uuid, Authorization: `Bearer ${secret}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  try {
    const { rows: [identity] } = await client.query("select current_database() db, current_setting('neon.project_id', true) project, current_setting('neon.branch_id', true) branch, current_setting('neon.endpoint_id', true) endpoint");
    assert.deepEqual(identity, { db: "neondb", project: "old-tooth-16761666", branch: "br-tiny-recipe-atpyb85n", endpoint: "ep-silent-hat-at3rhpgq" });
    for (const [suffix, secret] of [["A", secretA], ["B", secretB]]) {
      const uuid = `${prefix}_${suffix}`;
      const { rows: [device] } = await client.query("insert into nightly_devices (public_device_uuid,serial_number,device_secret_hash,claim_state,lifecycle_state,operational_state) values ($1,$1,$2,'claimed','active','healthy') returning id", [uuid, createHash("sha256").update(secret).digest("hex")]);
      deviceIds.push(device.id);
    }
    const telemetry = { schemaVersion: 1, uptimeSeconds: 200, memoryTotalBytes: 4096, memoryAvailableBytes: 2048, appliedConfigRevision: null };
    const heartbeat = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { agentVersion: "1.0.0", operationalState: "healthy", telemetry });
    assert.equal(heartbeat.status, 200);
    const { rows: [snapshot] } = await client.query("select telemetry_json,received_at from fleet_device_snapshots where device_id=$1", [deviceIds[0]]);
    assert.deepEqual(JSON.parse(snapshot.telemetry_json), telemetry);
    assert.ok(snapshot.received_at);
    const concurrent = await Promise.all([301, 302, 303, 304, 305].map((uptimeSeconds) =>
      deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { agentVersion: "1.0.0", operationalState: "healthy", telemetry: { ...telemetry, uptimeSeconds } })));
    assert.ok(concurrent.every((response) => response.status === 200));
    const { rows: [latest] } = await client.query("select count(*)::int total,max(received_at) latest_at,max(telemetry_json) latest_json from fleet_device_snapshots where device_id=$1", [deviceIds[0]]);
    assert.equal(latest.total, 1);
    assert.ok(latest.latest_at >= snapshot.received_at);
    assert.ok([301, 302, 303, 304, 305].includes(JSON.parse(latest.latest_json).uptimeSeconds));
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { telemetry: { ...telemetry, cameraPassword: "unsafe" } })).status, 400);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { telemetry: { ...telemetry, uploadQueueDepth: 100_001 } })).status, 400);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { telemetry, padding: "x".repeat(4096) })).status, 400);
    const { rows: [unchanged] } = await client.query("select telemetry_json from fleet_device_snapshots where device_id=$1", [deviceIds[0]]);
    assert.deepEqual(JSON.parse(unchanged.telemetry_json), JSON.parse(latest.latest_json));
    const status = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/status", "POST");
    assert.equal(status.status, 200);
    const statusBody = await status.json() as { device: { fleet: { state: string; health: string }; commissioning: { ready: boolean } } };
    assert.equal(statusBody.device.fleet.health, "healthy");
    assert.equal(statusBody.device.commissioning.ready, false);
    const checkedAt = new Date().toISOString();
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/commissioning", "POST", { checks: [{ checkKey: "internet", status: "pass", summary: "Connected", checkedAt, evidence: { connectivityVerified: true } }] })).status, 200);
    const resumed = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/status", "POST");
    const resumedBody = await resumed.json() as { device: { commissioning: { ready: boolean; steps: Array<{ key: string; status: string }> } } };
    assert.equal(resumedBody.device.commissioning.steps.find((step) => step.key === "network")?.status, "passed");
    assert.equal(resumedBody.device.commissioning.ready, false);
    const offlineAt = new Date();
    await client.query("update nightly_devices set last_heartbeat_at=$2 where id=$1", [deviceIds[0], new Date(offlineAt.getTime() - 6 * 60_000)]);
    await reconcileOfflineAlertsForDevices([deviceIds[0]], offlineAt);
    const offlineStatus = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/status", "POST");
    assert.equal((await offlineStatus.json() as { device: { fleet: { state: string; health: string } } }).device.fleet.state, "offline");
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { operationalState: "healthy", telemetry })).status, 200);
    const { rows: [recovered] } = await client.query("select count(*) filter (where code='DEVICE_OFFLINE' and state <> 'resolved')::int open_offline,count(*) filter (where code='DEVICE_RECONNECTED' and state='resolved')::int reconnected from fleet_device_alerts where device_id=$1", [deviceIds[0]]);
    assert.deepEqual(recovered, { open_offline: 0, reconnected: 1 });
    assert.equal((await deviceRequest(`${prefix}_A`, secretB, "/api/device/v1/operations", "GET")).status, 401);

    const { rows: [grant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,expires_at) values ($1,$2,'device.request_health_check',now()+interval '5 minutes') returning id", [deviceIds[0], `${prefix}_STAFF`]);
    const { rows: [operation] } = await client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,expires_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK',now()+interval '3 minutes') returning id", [deviceIds[0], grant.id, `${prefix}_HEALTH`]);
    const pending = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "GET");
    assert.equal(pending.status, 200);
    assert.deepEqual((await pending.json() as { operations: Array<{ id: number }> }).operations.map((item) => item.id), [operation.id]);
    assert.equal((await deviceRequest(`${prefix}_B`, secretB, "/api/device/v1/operations", "POST", { id: operation.id, resultCode: "health_ok" })).status, 404);
    await client.query("update nightly_devices set service_entitlement_state='suspended',service_suspended_at=now() where id=$1", [deviceIds[0]]);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/heartbeat", "POST", { agentVersion: "1.0.0", operationalState: "healthy", telemetry })).status, 200);
    const suspended = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/status", "POST");
    assert.equal(suspended.status, 200);
    assert.deepEqual((await suspended.json() as { device: { fleet: { commercialState: string; health: string } } }).device.fleet, { state: "suspended", health: "healthy", connectivity: "online", commercialState: "suspended" });
    const configResponse = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/config", "GET");
    assert.equal(configResponse.status, 200);
    assert.equal((await configResponse.json() as { sections: { commercial: { allowedCapabilities: string[] } } }).sections.commercial.allowedCapabilities.includes("device.capture"), false);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "GET")).status, 200);
    const completed = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "POST", { id: operation.id, resultCode: "health_ok" });
    assert.equal(completed.status, 200);
    assert.equal((await completed.json() as { duplicate: boolean }).duplicate, false);
    const replay = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "POST", { id: operation.id, resultCode: "health_ok" });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as { duplicate: boolean }).duplicate, true);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "POST", { id: operation.id, resultCode: "health_degraded" })).status, 409);
    const { rows: [state] } = await client.query("select state,result_code from fleet_device_operations where id=$1", [operation.id]);
    assert.deepEqual(state, { state: "succeeded", result_code: "health_ok" });
    const { rows: [expired] } = await client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,expires_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK',now()+interval '1 second') returning id", [deviceIds[0], grant.id, `${prefix}_EXPIRED`]);
    await client.query("update fleet_device_operations set expires_at=now()-interval '1 minute',created_at=now()-interval '2 minutes' where id=$1", [expired.id]);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "POST", { id: expired.id, resultCode: "health_ok" })).status, 410);
    await client.query("update fleet_support_grants set revoked_at=now() where id=$1", [grant.id]);
    const revokedList = await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "GET");
    assert.equal(revokedList.status, 200);
    assert.deepEqual((await revokedList.json() as { operations: unknown[] }).operations, []);
    const { rows: [expiringGrant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,expires_at) values ($1,$2,'device.request_health_check',now()+interval '1 minute') returning id", [deviceIds[0], `${prefix}_STAFF`]);
    const { rows: [pendingGrantOperation] } = await client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,expires_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK',now()+interval '1 minute') returning id", [deviceIds[0], expiringGrant.id, `${prefix}_GRANT_EXPIRED`]);
    await client.query("update fleet_support_grants set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' where id=$1", [expiringGrant.id]);
    assert.deepEqual((await (await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "GET")).json() as { operations: unknown[] }).operations, []);
    assert.equal((await deviceRequest(`${prefix}_A`, secretA, "/api/device/v1/operations", "POST", { id: pendingGrantOperation.id, resultCode: "health_ok" })).status, 410);
    const { rows: [audit] } = await client.query("select count(*)::int total from audit_logs where entity_type='nightly_device' and entity_id=$1 and action='fleet_health_check_completed' and actor_clerk_user_id=$2", [String(deviceIds[0]), `device:${prefix}_A`]);
    assert.equal(audit.total, 1);
  } finally {
    if (deviceIds.length) {
      await client.query("delete from audit_logs where entity_type='nightly_device' and entity_id=any($1::text[]) and actor_clerk_user_id like $2", [deviceIds.map(String), `device:${prefix}%`]);
      await client.query("delete from fleet_device_operations where device_id=any($1::int[])", [deviceIds]);
      await client.query("delete from fleet_support_grants where device_id=any($1::int[])", [deviceIds]);
      await client.query("delete from nightly_devices where id=any($1::int[]) and serial_number like $2", [deviceIds, `${prefix}%`]);
    }
    try {
      const { rows: [cleanup] } = await client.query("select (select count(*)::int from nightly_devices where serial_number like $1) devices, (select count(*)::int from fleet_device_snapshots where device_id=any($2::int[])) snapshots, (select count(*)::int from fleet_device_alerts where device_id=any($2::int[])) alerts, (select count(*)::int from fleet_device_operations where device_id=any($2::int[])) operations, (select count(*)::int from fleet_support_grants where device_id=any($2::int[])) grants, (select count(*)::int from audit_logs where entity_type='nightly_device' and entity_id=any($3::text[]) and actor_clerk_user_id like $4) audits", [`${prefix}%`, deviceIds, deviceIds.map(String), `device:${prefix}%`]);
      assert.deepEqual(cleanup, { devices: 0, snapshots: 0, alerts: 0, operations: 0, grants: 0, audits: 0 });
    } finally {
      client.release();
      await pool.end();
    }
  }
});