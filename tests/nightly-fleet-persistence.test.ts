import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import pg from "pg";
import { reconcileFleetAlerts, reconcileOfflineAlertsForDevices } from "../lib/nightly-device/fleet-alerts";
import { pruneFleetHistoryForDevices } from "../lib/nightly-device/fleet-retention";
import { advanceFleetUpdateTarget, scheduleSignedFleetCanary } from "../lib/nightly-device/fleet-canary";

test("Development fleet constraints and dedup survive concurrent-style retries without fixtures", { skip: process.env.NIGHTLY_FLEET_CERTIFY_DEVELOPMENT !== "true" }, async () => {
  config({ path: ".env.local", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(url.hostname.includes("ep-silent-hat-at3rhpgq-pooler") && !url.hostname.includes("ep-rough-mud-atcx5jvx"));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const prefix = `S8_FLEET_${randomUUID().replaceAll("-", "")}`;
  let transactionOpen = false;
  try {
    const { rows: [identity] } = await client.query("select current_database() db, current_setting('neon.project_id', true) project, current_setting('neon.branch_id', true) branch, current_setting('neon.endpoint_id', true) endpoint");
    assert.deepEqual(identity, { db: "neondb", project: "old-tooth-16761666", branch: "br-tiny-recipe-atpyb85n", endpoint: "ep-silent-hat-at3rhpgq" });
    await client.query("BEGIN");
    transactionOpen = true;
    const { rows: [first] } = await client.query("insert into nightly_devices (public_device_uuid,serial_number) values ($1,$2) returning id", [`${prefix}_A`, `${prefix}_A`]);
    const { rows: [second] } = await client.query("insert into nightly_devices (public_device_uuid,serial_number) values ($1,$2) returning id", [`${prefix}_B`, `${prefix}_B`]);
    await client.query("insert into fleet_device_snapshots (device_id,telemetry_json) values ($1,$2) on conflict (device_id) do update set telemetry_json=excluded.telemetry_json", [first.id, '{"schemaVersion":1}']);
    await client.query("insert into fleet_device_snapshots (device_id,telemetry_json) values ($1,$2) on conflict (device_id) do update set telemetry_json=excluded.telemetry_json", [first.id, '{"schemaVersion":1,"uptimeSeconds":60}']);
    const { rows: [snapshot] } = await client.query("select count(*)::int total,max(telemetry_json) telemetry from fleet_device_snapshots where device_id=$1", [first.id]);
    assert.equal(snapshot.total, 1);
    assert.match(snapshot.telemetry, /uptimeSeconds/);
    await client.query("insert into fleet_device_alerts (device_id,code,severity) values ($1,'DEVICE_OFFLINE','critical') on conflict (device_id,code) where state <> 'resolved' do update set occurrence_count=fleet_device_alerts.occurrence_count+1", [first.id]);
    await client.query("insert into fleet_device_alerts (device_id,code,severity) values ($1,'DEVICE_OFFLINE','critical') on conflict (device_id,code) where state <> 'resolved' do update set occurrence_count=fleet_device_alerts.occurrence_count+1", [first.id]);
    const { rows: [alert] } = await client.query("select count(*)::int total,max(occurrence_count)::int occurrences from fleet_device_alerts where device_id=$1 and state <> 'resolved'", [first.id]);
    assert.deepEqual(alert, { total: 1, occurrences: 2 });
    await client.query("update fleet_device_alerts set state='resolved',resolved_at=now() where device_id=$1", [first.id]);
    await client.query("insert into fleet_device_alerts (device_id,code,severity) values ($1,'DEVICE_OFFLINE','critical')", [first.id]);
    const { rows: [history] } = await client.query("select count(*)::int total from fleet_device_alerts where device_id=$1", [first.id]);
    assert.equal(history.total, 2);
    const { rows: [grant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,expires_at) values ($1,$2,'device.request_health_check',now()+interval '5 minutes') returning id", [first.id, `${prefix}_ACTOR`]);
    await client.query("SAVEPOINT cross_device");
    await assert.rejects(client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,expires_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK',now()+interval '1 minute')", [second.id, grant.id, `${prefix}_CROSS`]), (error: unknown) => (error as { code?: string }).code === "23503");
    await client.query("ROLLBACK TO SAVEPOINT cross_device");
    await client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,expires_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK',now()+interval '1 minute') on conflict (device_id,idempotency_key) do nothing", [first.id, grant.id, `${prefix}_ONCE`]);
    await client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,expires_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK',now()+interval '1 minute') on conflict (device_id,idempotency_key) do nothing", [first.id, grant.id, `${prefix}_ONCE`]);
    const { rows: [operation] } = await client.query("select count(*)::int total from fleet_device_operations where device_id=$1", [first.id]);
    assert.equal(operation.total, 1);
    const { rows: rollouts } = await client.query("insert into fleet_update_rollouts (target_version,manifest_json,created_by_clerk_user_id) values ('1.2.3','{}',$1),('1.2.4','{}',$1) returning id", [`${prefix}_STAFF`]);
    await client.query("insert into fleet_update_targets (rollout_id,device_id) values ($1,$2)", [rollouts[0].id, first.id]);
    await client.query("SAVEPOINT active_update");
    await assert.rejects(client.query("insert into fleet_update_targets (rollout_id,device_id) values ($1,$2)", [rollouts[1].id, first.id]), (error: unknown) => (error as { code?: string }).code === "23505");
    await client.query("ROLLBACK TO SAVEPOINT active_update");
    await client.query("update fleet_update_targets set state='failed' where rollout_id=$1 and device_id=$2", [rollouts[0].id, first.id]);
    await client.query("insert into fleet_update_targets (rollout_id,device_id) values ($1,$2)", [rollouts[1].id, first.id]);
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    try {
      const { rows: [cleanup] } = await client.query("select count(*)::int total from nightly_devices where serial_number like $1", [`${prefix}%`]);
      assert.equal(cleanup.total, 0);
    } finally { client.release(); await pool.end(); }
  }
});

test("Development offline alert deduplicates and resolves on reconnect", { skip: process.env.NIGHTLY_FLEET_CERTIFY_DEVELOPMENT !== "true" }, async () => {
  config({ path: ".env.local", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(url.hostname.includes("ep-silent-hat-at3rhpgq-pooler") && !url.hostname.includes("ep-rough-mud-atcx5jvx"));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const prefix = `S8_FLEET_${randomUUID().replaceAll("-", "")}`;
  let deviceId: number | null = null;
  try {
    const { rows: [identity] } = await client.query("select current_database() db, current_setting('neon.project_id', true) project, current_setting('neon.branch_id', true) branch, current_setting('neon.endpoint_id', true) endpoint");
    assert.deepEqual(identity, { db: "neondb", project: "old-tooth-16761666", branch: "br-tiny-recipe-atpyb85n", endpoint: "ep-silent-hat-at3rhpgq" });
    const now = new Date();
    const { rows: [device] } = await client.query("insert into nightly_devices (public_device_uuid,serial_number,claim_state,lifecycle_state,operational_state,last_heartbeat_at) values ($1,$2,'claimed','active','healthy',$3) returning id", [`${prefix}_OFFLINE`, `${prefix}_OFFLINE`, new Date(now.getTime() - 10 * 60_000)]);
    deviceId = device.id;
    await Promise.all([reconcileOfflineAlertsForDevices([deviceId!], now), reconcileOfflineAlertsForDevices([deviceId!], now)]);
    const { rows: [offline] } = await client.query("select count(*)::int active,max(occurrence_count)::int occurrences from fleet_device_alerts where device_id=$1 and code='DEVICE_OFFLINE' and state <> 'resolved'", [deviceId]);
    assert.equal(offline.active, 1);
    assert.equal(offline.occurrences, 1);
    await pruneFleetHistoryForDevices([deviceId!], now);
    const { rows: [afterPrune] } = await client.query("select count(*)::int active from fleet_device_alerts where device_id=$1 and code='DEVICE_OFFLINE' and state='open'", [deviceId]);
    assert.equal(afterPrune.active, 1);
    await client.query("update nightly_devices set last_heartbeat_at=$2 where id=$1", [deviceId, now]);
    await reconcileFleetAlerts(deviceId!, [], now, ["DEVICE_OFFLINE"]);
    const { rows: [recovered] } = await client.query("select count(*) filter (where state <> 'resolved')::int active,count(*) filter (where state='resolved')::int resolved from fleet_device_alerts where device_id=$1 and code='DEVICE_OFFLINE'", [deviceId]);
    assert.deepEqual(recovered, { active: 0, resolved: 1 });
    await reconcileFleetAlerts(deviceId!, [], now, ["DEVICE_OFFLINE"]);
    const { rows: [reconnected] } = await client.query("select count(*)::int total from fleet_device_alerts where device_id=$1 and code='DEVICE_RECONNECTED' and state='resolved'", [deviceId]);
    assert.equal(reconnected.total, 1);
    await client.query("update fleet_device_alerts set resolved_at=$2 where device_id=$1 and state='resolved'", [deviceId, new Date(now.getTime() - 31 * 24 * 60 * 60_000)]);
    const { rows: [oldGrant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,created_at,expires_at) values ($1,$2,'device.request_health_check',$3,$4) returning id", [deviceId, `${prefix}_STAFF`, new Date(now.getTime() - 33 * 24 * 60 * 60_000), new Date(now.getTime() - 32 * 24 * 60 * 60_000)]);
    await client.query("insert into fleet_device_operations (device_id,grant_id,idempotency_key,type,state,created_at,expires_at,completed_at) values ($1,$2,$3,'REQUEST_HEALTH_CHECK','succeeded',$4,$5,$6)", [deviceId, oldGrant.id, `${prefix}_OLD`, new Date(now.getTime() - 33 * 24 * 60 * 60_000), new Date(now.getTime() - 32 * 24 * 60 * 60_000), new Date(now.getTime() - 31 * 24 * 60 * 60_000)]);
    assert.deepEqual(await pruneFleetHistoryForDevices([deviceId!], now), { alerts: 2, operations: 1, grants: 1 });
  } finally {
    if (deviceId !== null) await client.query("delete from nightly_devices where id=$1 and serial_number=$2", [deviceId, `${prefix}_OFFLINE`]);
    try {
      const { rows: [remaining] } = await client.query("select count(*)::int total from nightly_devices where serial_number like $1", [`${prefix}%`]);
      assert.equal(remaining.total, 0);
    } finally { client.release(); await pool.end(); }
  }
});

test("Development fleet sweep authenticates and retries only selected cursor batches", { skip: process.env.NIGHTLY_FLEET_CERTIFY_DEVELOPMENT !== "true", timeout: 30_000 }, async () => {
  config({ path: ".env.local", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(url.hostname.includes("ep-silent-hat-at3rhpgq-pooler") && !url.hostname.includes("ep-rough-mud-atcx5jvx"));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const prefix = `S8_FLEET_${randomUUID().replaceAll("-", "")}`;
  const requestId = randomUUID();
  const token = randomBytes(48).toString("base64url");
  const previousToken = process.env.NIGHTLY_FLEET_SWEEP_TOKEN;
  const deviceIds: number[] = [];
  try {
    const { rows: [identity] } = await client.query("select current_database() db, current_setting('neon.project_id', true) project, current_setting('neon.branch_id', true) branch, current_setting('neon.endpoint_id', true) endpoint");
    assert.deepEqual(identity, { db: "neondb", project: "old-tooth-16761666", branch: "br-tiny-recipe-atpyb85n", endpoint: "ep-silent-hat-at3rhpgq" });
    process.env.NIGHTLY_FLEET_SWEEP_TOKEN = token;
    const { POST } = await import("../app/api/admin/fleet/sweep/route");
    async function sweep(authorization: string | null, body: object) {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (authorization) headers.authorization = `Bearer ${authorization}`;
      return POST(new Request("https://nightly.test/api/admin/fleet/sweep", { method: "POST", headers, body: JSON.stringify(body) }));
    }
    assert.equal((await sweep(null, { cursor: 0, requestId })).status, 401);
    assert.equal((await sweep(`${token}wrong`, { cursor: 0, requestId })).status, 401);
    assert.equal((await sweep(token, { cursor: 0, limit: 101, requestId })).status, 400);
    assert.equal((await sweep(token, { cursor: 0, requestId, deviceIds: [1, 1] })).status, 400);
    for (const suffix of ["A", "B"]) {
      const { rows: [device] } = await client.query("insert into nightly_devices (public_device_uuid,serial_number,claim_state,lifecycle_state,operational_state,last_heartbeat_at) values ($1,$1,'claimed','active','healthy',$2) returning id", [`${prefix}_${suffix}`, new Date(Date.now() - 10 * 60_000)]);
      deviceIds.push(device.id);
    }
    const body = { cursor: deviceIds[0] - 1, limit: 1, requestId, deviceIds };
    const first = await sweep(token, body);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { ok: true, processed: 1, nextCursor: deviceIds[0] });
    const { rows: [firstAlert] } = await client.query("select count(*)::int total from fleet_device_alerts where device_id=$1 and code='DEVICE_OFFLINE' and state='open'", [deviceIds[0]]);
    assert.equal(firstAlert.total, 1);
    const duplicate = await sweep(token, body);
    assert.equal(duplicate.status, 200);
    const second = await sweep(token, { ...body, cursor: deviceIds[0] });
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { ok: true, processed: 1, nextCursor: deviceIds[1] });
    const done = await sweep(token, { ...body, cursor: deviceIds[1] });
    assert.deepEqual(await done.json(), { ok: true, processed: 0, nextCursor: null });
    const { rows: alerts } = await client.query("select device_id,count(*)::int total,max(occurrence_count)::int occurrences from fleet_device_alerts where device_id=any($1::int[]) and code='DEVICE_OFFLINE' and state='open' group by device_id order by device_id", [deviceIds]);
    assert.deepEqual(alerts, deviceIds.map((device_id) => ({ device_id, total: 1, occurrences: 1 })));
  } finally {
    if (previousToken === undefined) delete process.env.NIGHTLY_FLEET_SWEEP_TOKEN;
    else process.env.NIGHTLY_FLEET_SWEEP_TOKEN = previousToken;
    try {
      await client.query("delete from audit_logs where actor_clerk_user_id='fleet-scheduler' and entity_type='fleet' and action='fleet_sweep_completed' and metadata_json like $1", [`%${requestId}%`]);
      if (deviceIds.length) await client.query("delete from nightly_devices where id=any($1::int[]) and serial_number like $2", [deviceIds, `${prefix}%`]);
      const { rows: [remaining] } = await client.query("select (select count(*)::int from nightly_devices where serial_number like $1) devices,(select count(*)::int from audit_logs where actor_clerk_user_id='fleet-scheduler' and metadata_json like $2) audits", [`${prefix}%`, `%${requestId}%`]);
      assert.deepEqual(remaining, { devices: 0, audits: 0 });
    } finally { client.release(); await pool.end(); }
  }
});

test("Development canary scheduling verifies ephemeral signatures and retries idempotently", { skip: process.env.NIGHTLY_FLEET_CERTIFY_DEVELOPMENT !== "true", timeout: 30_000 }, async () => {
  config({ path: ".env.local", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(url.hostname.includes("ep-silent-hat-at3rhpgq-pooler") && !url.hostname.includes("ep-rough-mud-atcx5jvx"));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const prefix = `S8_OTA_${randomUUID().replaceAll("-", "")}`;
  const actorClerkUserId = `${prefix}_ACTOR`;
  const deviceIds: number[] = [];
  try {
    const { rows: [identity] } = await client.query("select current_database() db,current_setting('neon.project_id',true) project,current_setting('neon.branch_id',true) branch,current_setting('neon.endpoint_id',true) endpoint");
    assert.deepEqual(identity, { db: "neondb", project: "old-tooth-16761666", branch: "br-tiny-recipe-atpyb85n", endpoint: "ep-silent-hat-at3rhpgq" });
    for (const suffix of ["A", "B"]) {
      const { rows: [device] } = await client.query("insert into nightly_devices (public_device_uuid,serial_number,hardware_model,agent_version,claim_state,lifecycle_state) values ($1,$1,'nightly-box-v1','1.0.0','claimed','active') returning id", [`${prefix}_${suffix}`]);
      deviceIds.push(device.id);
    }
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const unsigned = { version: "1.2.3", sha256: "a".repeat(64), downloadUrl: "https://updates.example.test/nightly-agent.tar", notBefore: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), hardwareModels: ["nightly-box-v1"] };
    const manifest = { ...unsigned, signature: sign(null, Buffer.from(JSON.stringify(unsigned)), privateKey).toString("base64") };
    const input = { deviceIds, manifest, publicKeyPem, actorClerkUserId };
    const [first, replay] = await Promise.all([scheduleSignedFleetCanary(input), scheduleSignedFleetCanary(input)]);
    assert.equal(first.rolloutId, replay.rolloutId);
    assert.deepEqual([first.duplicate, replay.duplicate].sort(), [false, true]);
    await assert.rejects(scheduleSignedFleetCanary({ ...input, manifest: { ...manifest, sha256: "b".repeat(64) } }), /incompatible or manifest is untrusted/);
    await assert.rejects(scheduleSignedFleetCanary({ ...input, manifest: { ...manifest, hardwareModels: ["wrong-box"] } }), /incompatible or manifest is untrusted/);
    await client.query("update nightly_devices set agent_version='1.2.3' where id=$1", [deviceIds[0]]);
    await assert.rejects(scheduleSignedFleetCanary(input), /incompatible or manifest is untrusted/);
    const { rows: [counts] } = await client.query("select (select count(*)::int from fleet_update_rollouts where created_by_clerk_user_id=$1) rollouts,(select count(*)::int from fleet_update_targets where device_id=any($2::int[])) targets,(select count(*)::int from audit_logs where entity_type='fleet_rollout' and action='fleet_canary_scheduled' and actor_clerk_user_id=$1) audits", [actorClerkUserId, deviceIds]);
    assert.deepEqual(counts, { rollouts: 1, targets: 2, audits: 1 });
    const { rows: [target] } = await client.query("select id from fleet_update_targets where rollout_id=$1 and device_id=$2", [first.rolloutId, deviceIds[0]]);
    const transition = { targetId: target.id, deviceId: deviceIds[0], expectedState: "scheduled" as const, nextState: "downloading" as const, manifestVerified: true, postUpdateHealthVerified: false, rollbackVerified: false };
    await assert.rejects(advanceFleetUpdateTarget({ ...transition, deviceId: deviceIds[1] }), /unavailable/);
    assert.deepEqual(await advanceFleetUpdateTarget(transition), { state: "downloading", duplicate: false });
    assert.deepEqual(await advanceFleetUpdateTarget(transition), { state: "downloading", duplicate: true });
    await assert.rejects(advanceFleetUpdateTarget({ ...transition, nextState: "installing" }), /Stale update result/);
    assert.deepEqual(await advanceFleetUpdateTarget({ ...transition, expectedState: "downloading", nextState: "verifying" }), { state: "verifying", duplicate: false });
    await assert.rejects(advanceFleetUpdateTarget({ ...transition, expectedState: "verifying", nextState: "installing", manifestVerified: false }), /Unverified update transition/);
    assert.deepEqual(await advanceFleetUpdateTarget({ ...transition, expectedState: "verifying", nextState: "failed", manifestVerified: false, failureCode: "signature_invalid" }), { state: "failed", duplicate: false });
    await assert.rejects(advanceFleetUpdateTarget({ ...transition, expectedState: "verifying", nextState: "installing" }), /Stale update result/);
    assert.deepEqual(await advanceFleetUpdateTarget({ ...transition, expectedState: "failed", nextState: "recovery_required" }), { state: "recovery_required", duplicate: false });
    await assert.rejects(advanceFleetUpdateTarget({ ...transition, expectedState: "recovery_required", nextState: "rolled_back", rollbackVerified: false }), /Unverified update transition/);
    const { rows: [finalTarget] } = await client.query("select state,failure_code from fleet_update_targets where id=$1", [target.id]);
    assert.deepEqual(finalTarget, { state: "recovery_required", failure_code: "signature_invalid" });
  } finally {
    try {
      const { rows: rollouts } = await client.query("select id from fleet_update_rollouts where created_by_clerk_user_id=$1", [actorClerkUserId]);
      const rolloutIds = rollouts.map((row) => row.id);
      if (rolloutIds.length) {
        await client.query("delete from audit_logs where entity_type='fleet_rollout' and entity_id=any($1::text[]) and actor_clerk_user_id=$2", [rolloutIds.map(String), actorClerkUserId]);
        const { rows: targets } = await client.query("select id from fleet_update_targets where rollout_id=any($1::int[]) and device_id=any($2::int[])", [rolloutIds, deviceIds]);
        if (targets.length) await client.query("delete from audit_logs where entity_type='fleet_update_target' and actor_clerk_user_id='fleet-update-controller' and entity_id=any($1::text[])", [targets.map((row) => String(row.id))]);
        await client.query("delete from fleet_update_targets where rollout_id=any($1::int[]) and device_id=any($2::int[])", [rolloutIds, deviceIds]);
        await client.query("delete from fleet_update_rollouts where id=any($1::int[]) and created_by_clerk_user_id=$2", [rolloutIds, actorClerkUserId]);
      }
      if (deviceIds.length) await client.query("delete from nightly_devices where id=any($1::int[]) and serial_number like $2", [deviceIds, `${prefix}%`]);
      const { rows: [remaining] } = await client.query("select (select count(*)::int from nightly_devices where serial_number like $1) devices,(select count(*)::int from fleet_update_rollouts where created_by_clerk_user_id=$2) rollouts,(select count(*)::int from fleet_update_targets where device_id=any($3::int[])) targets,(select count(*)::int from audit_logs where actor_clerk_user_id=$2) audits", [`${prefix}%`, actorClerkUserId, deviceIds]);
      assert.deepEqual(remaining, { devices: 0, rollouts: 0, targets: 0, audits: 0 });
    } finally { client.release(); await pool.end(); }
  }
});