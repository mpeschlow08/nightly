import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import pg from "pg";

test("Development Clerk sessions enforce Fleet Admin and Owner route boundaries", {
  skip: process.env.NIGHTLY_FLEET_ROLE_CERTIFY_DEVELOPMENT !== "true", timeout: 90_000,
}, async () => {
  config({ path: ".env.local", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  const base = new URL(process.env.NIGHTLY_FLEET_API_BASE_URL ?? "");
  assert.ok(url.hostname.includes("ep-silent-hat-at3rhpgq-pooler") && !url.hostname.includes("ep-rough-mud-atcx5jvx"));
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname) && base.protocol === "http:");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const prefix = `S8_ROLE_${randomUUID().replaceAll("-", "")}`;
  const deviceIds: number[] = [];
  let adminActorId: string | null = null;
  let techStaffId: number | null = null;
  let clerk: Awaited<ReturnType<typeof import("@clerk/nextjs/server")["clerkClient"]>> | null = null;
  const sessions: string[] = [];
  try {
    const { rows: [identity] } = await client.query("select current_database() db,current_setting('neon.project_id',true) project,current_setting('neon.branch_id',true) branch,current_setting('neon.endpoint_id',true) endpoint");
    assert.deepEqual(identity, { db: "neondb", project: "old-tooth-16761666", branch: "br-tiny-recipe-atpyb85n", endpoint: "ep-silent-hat-at3rhpgq" });
    const { rows: [admin] } = await client.query("select u.clerk_user_id from users u join admin_assignments a on a.clerk_user_id=u.clerk_user_id and a.status='active' join admin_roles r on r.id=a.role_id where u.role='admin' and u.account_status='active' and r.key='super_admin' and (a.expires_at is null or a.expires_at>now()) limit 1");
    const { rows: owners } = await client.query("select m.clerk_user_id,m.venue_id from venue_members m join users u on u.clerk_user_id=m.clerk_user_id where m.role='owner' and u.account_status='active' and (select count(*) from venue_members all_m where all_m.clerk_user_id=m.clerk_user_id)=1 order by m.venue_id limit 30");
    const owner = owners[0];
    const otherOwner = owners.find((candidate) => candidate.venue_id !== owner?.venue_id && candidate.clerk_user_id !== owner?.clerk_user_id);
    assert.ok(admin?.clerk_user_id && owner?.clerk_user_id && otherOwner?.clerk_user_id, "Existing active Admin and two distinct Owner venues are required.");
    adminActorId = admin.clerk_user_id;
    clerk = await (await import("@clerk/nextjs/server")).clerkClient();
    async function sessionFor(userId: string) {
      const session = await clerk!.sessions.createSession({ userId });
      sessions.push(session.id);
      return (await clerk!.sessions.getToken(session.id)).jwt;
    }
    const adminToken = await sessionFor(admin.clerk_user_id);
    const ownerToken = await sessionFor(owner.clerk_user_id);
    const otherOwnerToken = await sessionFor(otherOwner.clerk_user_id);
    const { rows: consumers } = await client.query("select u.clerk_user_id from users u where u.role='consumer' and u.account_status='active' and not exists (select 1 from venue_staff_profiles s where s.clerk_user_id=u.clerk_user_id and s.status='active') limit 20");
    let techUserId: string | null = null;
    for (const consumer of consumers) {
      try { await clerk.users.getUser(consumer.clerk_user_id); techUserId = consumer.clerk_user_id; break; } catch { continue; }
    }
    assert.ok(techUserId, "An existing Clerk consumer without active staff roles is required.");
    const { rows: [staff] } = await client.query("insert into venue_staff_profiles (venue_id,clerk_user_id,first_name,last_name,email,department,job_title,permissions_json,status) values ($1,$2,'Nightly','FleetCertification',$3,'operations','Fleet role certification fixture',$4,'active') returning id", [owner.venue_id, techUserId, `${prefix.toLowerCase()}@invalid.example`, JSON.stringify(["nightly_device:operate"])]);
    techStaffId = staff.id;
    const techToken = await sessionFor(techUserId);
    for (const [suffix, venueId] of [["A", owner.venue_id], ["B", otherOwner.venue_id]] as const) {
      const { rows: [device] } = await client.query("insert into nightly_devices (venue_id,public_device_uuid,serial_number,public_device_name,claim_state,lifecycle_state,operational_state,last_heartbeat_at) values ($1,$2,$2,$2,'claimed','active','healthy',$3) returning id", [venueId, `${prefix}_${suffix}`, new Date()]);
      deviceIds.push(device.id);
    }
    async function page(path: string, token?: string) {
      return fetch(new URL(path, base), { headers: token ? { Authorization: `Bearer ${token}` } : {}, redirect: "manual", signal: AbortSignal.timeout(12_000) });
    }
    const adminPage = await page(`/admin/fleet?q=${prefix}`, adminToken);
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    assert.equal(adminHtml.includes(`${prefix}_A`) && adminHtml.includes(`${prefix}_B`), true, JSON.stringify({ adminStatus: adminPage.status, denied: adminHtml.includes("Permission Denied"), hasA: adminHtml.includes(`${prefix}_A`), hasB: adminHtml.includes(`${prefix}_B`) }));
    const ownerPage = await page("/admin/fleet", ownerToken);
    const ownerDenied = await ownerPage.text();
    assert.match(ownerDenied, /Admin access is required|Permission Denied/);
    assert.equal(ownerDenied.includes(`${prefix}_A`) || ownerDenied.includes(`${prefix}_B`), false);
    const techDenied = await (await page("/admin/fleet", techToken)).text();
    assert.match(techDenied, /Admin access is required|Permission Denied/);
    assert.equal(techDenied.includes(`${prefix}_A`) || techDenied.includes(`${prefix}_B`), false);
    assert.equal((await page("/admin/fleet")).status === 200, false);
    const ownerDevices = await page("/owner/devices", ownerToken);
    assert.equal(ownerDevices.status, 200);
    const ownerHtml = await ownerDevices.text();
    assert.equal(ownerHtml.includes(`${prefix}_A`), true, JSON.stringify({ own: ownerHtml.includes(`${prefix}_A`), foreign: ownerHtml.includes(`${prefix}_B`), empty: ownerHtml.includes("No Nightly Box is assigned"), unavailable: ownerHtml.includes("Venue device access is not available"), claim: ownerHtml.includes("Claim a device") }));
    assert.equal(ownerHtml.includes(`${prefix}_B`), false);
    assert.match(ownerHtml, /Claim a device/);
    const otherDevices = await page("/owner/devices", otherOwnerToken);
    assert.equal(otherDevices.status, 200);
    const otherHtml = await otherDevices.text();
    assert.match(otherHtml, new RegExp(`${prefix}_B`));
    assert.equal(otherHtml.includes(`${prefix}_A`), false);
    const techDevices = await page("/owner/devices", techToken);
    assert.equal(techDevices.status, 200);
    const techHtml = await techDevices.text();
    assert.match(techHtml, new RegExp(`${prefix}_A`));
    assert.equal(techHtml.includes(`${prefix}_B`), false);
    assert.equal(techHtml.includes("Claim a device"), false);
    for (const token of [ownerToken, otherOwnerToken, techToken]) {
      const response = await fetch(new URL(`/api/admin/fleet/${deviceIds[0]}/diagnostics`, base), { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: base.origin }, redirect: "manual", signal: AbortSignal.timeout(12_000) });
      assert.equal(response.status, 403);
      assert.equal((await response.text()).includes(`${prefix}_A`), false);
      const bundle = await fetch(new URL(`/api/admin/fleet/${deviceIds[1]}/support-bundle`, base), { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: base.origin }, redirect: "manual", signal: AbortSignal.timeout(12_000) });
      assert.equal(bundle.status, 403);
    }
    async function support(path: string, body?: object) {
      return fetch(new URL(path, base), { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, Origin: base.origin, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(12_000) });
    }
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 10 * 60_000);
    const { rows: [foreignGrant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,created_at,expires_at) values ($1,$2,'device.read_diagnostics',$3,$4) returning id", [deviceIds[1], adminActorId, issuedAt.toISOString(), expiresAt.toISOString()]);
    const { rows: [grantCheck] } = await client.query("select device_id=$2 device_matches,actor_clerk_user_id=$3 actor_matches,expires_at > $4::timestamp app_active,expires_at > now()::timestamp db_active from fleet_support_grants where id=$1", [foreignGrant.id, deviceIds[1], adminActorId, new Date().toISOString()]);
    assert.deepEqual(grantCheck, { device_matches: true, actor_matches: true, app_active: true, db_active: true });
    assert.equal((await support(`/api/admin/fleet/${deviceIds[0]}/diagnostics`, { grantId: foreignGrant.id })).status, 403);
    const ownDiagnostics = await support(`/api/admin/fleet/${deviceIds[1]}/diagnostics`, { grantId: foreignGrant.id });
    const ownDiagnosticsBody = await ownDiagnostics.json() as { deviceId?: number; error?: string };
    assert.equal(ownDiagnostics.status, 200, ownDiagnosticsBody.error ?? "unexpected_status");
    assert.equal(ownDiagnosticsBody.deviceId, deviceIds[1]);
    const { rows: [ownGrant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,created_at,expires_at) values ($1,$2,'device.read_diagnostics',$3,$4) returning id", [deviceIds[0], adminActorId, issuedAt.toISOString(), expiresAt.toISOString()]);
    assert.equal((await support(`/api/admin/fleet/${deviceIds[0]}/diagnostics`, { grantId: foreignGrant.id })).status, 200);
    const { rows: [usedGrant] } = await client.query("select metadata_json from audit_logs where entity_type='nightly_device' and entity_id=$1 and action='fleet_diagnostics_read' and actor_clerk_user_id=$2 order by id desc limit 1", [String(deviceIds[0]), adminActorId]);
    assert.equal(JSON.parse(usedGrant.metadata_json).grantId, ownGrant.id);
    const { rows: [bundleGrant] } = await client.query("insert into fleet_support_grants (device_id,actor_clerk_user_id,scope,created_at,expires_at) values ($1,$2,'device.collect_support_bundle',$3,$4) returning id", [deviceIds[1], adminActorId, issuedAt.toISOString(), expiresAt.toISOString()]);
    const ownBundle = await support(`/api/admin/fleet/${deviceIds[1]}/support-bundle`);
    const ownBundleBody = await ownBundle.json() as { deviceId?: number; error?: string };
    assert.equal(ownBundle.status, 200, ownBundleBody.error ?? "unexpected_status");
    assert.equal(ownBundleBody.deviceId, deviceIds[1]);
    assert.equal((await page(`/admin/fleet/${deviceIds[1]}`, ownerToken)).status === 200 && (await (await page(`/admin/fleet/${deviceIds[1]}`, ownerToken)).text()).includes(`${prefix}_B`), false);
    await client.query("update venue_staff_profiles set status='terminated' where id=$1", [techStaffId]);
    const revokedTechPage = await page("/owner/devices", techToken);
    assert.equal((await revokedTechPage.text()).includes(`${prefix}_A`), false);
  } finally {
    try {
      if (deviceIds.length && adminActorId) await client.query("delete from audit_logs where entity_type='nightly_device' and entity_id=any($1::text[]) and actor_clerk_user_id=$2 and action in ('fleet_diagnostics_read','fleet_support_bundle_issued')", [deviceIds.map(String), adminActorId]);
      if (deviceIds.length) await client.query("delete from nightly_devices where id=any($1::int[]) and serial_number like $2", [deviceIds, `${prefix}%`]);
      if (techStaffId !== null) await client.query("delete from venue_staff_profiles where id=$1 and email=$2", [techStaffId, `${prefix.toLowerCase()}@invalid.example`]);
      for (const id of sessions) await clerk?.sessions.revokeSession(id);
      const { rows: [remaining] } = await client.query("select (select count(*)::int from nightly_devices where serial_number like $1) devices,(select count(*)::int from venue_staff_profiles where email=$2) staff,(select count(*)::int from audit_logs where entity_type='nightly_device' and entity_id=any($3::text[]) and action in ('fleet_diagnostics_read','fleet_support_bundle_issued')) audits", [`${prefix}%`, `${prefix.toLowerCase()}@invalid.example`, deviceIds.map(String)]);
      assert.deepEqual(remaining, { devices: 0, staff: 0, audits: 0 });
    } finally { client.release(); await pool.end(); }
  }
});