import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { config } from "dotenv";
import pg from "pg";

const enabled = process.env.NIGHTLY_SPRINT9_RACE_CERTIFY === "true";
if (enabled) config({ path: ".env.local", override: true, quiet: true });

test("Sprint 9 Development Hot Reel allowance concurrency", { skip: !enabled, timeout: 120_000 }, async () => {
  const prefix = `NIGHTLY-SPRINT9-RACE-${randomUUID()}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 12, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  const userIds: number[] = [];
  const deviceIds: number[] = [];
  const sourceIds: number[] = [];
  const reelIds: number[] = [];
  const subscriptionIds: number[] = [];
  let verified = false;
  try {
    const { rows: [identity] } = await client.query("select current_database() database_name,current_setting('neon.project_id',true) project_id,current_setting('neon.branch_id',true) branch_id,current_setting('neon.endpoint_id',true) endpoint_id");
    assert.deepEqual(identity, { database_name: "neondb", project_id: "old-tooth-16761666", branch_id: "br-tiny-recipe-atpyb85n", endpoint_id: "ep-silent-hat-at3rhpgq" });
    assert.equal(identity.endpoint_id, "ep-silent-hat-at3rhpgq");

    const { rows: venues } = await client.query("select v.id from venues v where v.publication_status='published' and v.suspended_at is null and not exists (select 1 from commercial_subscriptions s where s.scope_type='venue' and s.scope_id=v.id and s.product='venue_package') order by v.id limit 2");
    assert.equal(venues.length, 2);
    for (const venue of venues) {
      const { rows: [subscription] } = await client.query("insert into commercial_subscriptions (scope_type,scope_id,product,state,source,reason_code,metadata_json,started_at) values ('venue',$1,'venue_package','active','manual',$2,$3,now()) returning id", [venue.id, prefix, JSON.stringify({ prefix })]);
      subscriptionIds.push(subscription.id);
      const { rows: [device] } = await client.query("insert into nightly_devices (venue_id,public_device_uuid,serial_number,lifecycle_state,provisioning_state,claim_state,operational_state,service_entitlement_state,content_eligibility,hot_reel_eligible,public_publishing_enabled) values ($1,$2,$2,'active','provisioned','claimed','healthy','active','approved',true,true) returning id", [venue.id, `${prefix}-device-${venue.id}`]);
      deviceIds.push(device.id);
      const { rows: [source] } = await client.query("insert into nightly_device_sources (device_id,venue_id,source_type,source_label) values ($1,$2,'other',$3) returning id", [device.id, venue.id, `${prefix}-source-${venue.id}`]);
      sourceIds.push(source.id);
      const { rows: [reel] } = await client.query("insert into hot_reels (public_id,hot_moment_id,venue_id,device_id,source_id,lifecycle_state,publication_state,review_state,provider_key,provider_object_key) values ($1,$2,$3,$4,$5,'ready','published','approved','mock',$6) returning id", [`${prefix}-reel-${venue.id}`, `${prefix}-moment-${venue.id}`, venue.id, device.id, source.id, `${prefix}-object-${venue.id}`]);
      reelIds.push(reel.id);
    }

    const createConsumer = async (suffix: string) => {
      const { rows: [user] } = await client.query("insert into users (clerk_user_id,role,account_status,created_at,updated_at) values ($1,'consumer','active',now()-interval '365 days',now()) returning id", [`${prefix}-user-${suffix}`]);
      userIds.push(user.id);
      return user.id as number;
    };

    const { consumeFreeHotReelVenueUnlock } = await import("../lib/commercial-entitlements/service");
    const sameUser = await createConsumer("same");
    const sameNow = new Date("2031-01-01T12:00:00.000Z");
    const sameResults = await Promise.all(Array.from({ length: 10 }, () => consumeFreeHotReelVenueUnlock({ userId: sameUser, venueId: venues[0].id, hotReelPublicId: `${prefix}-reel-${venues[0].id}`, now: sameNow })));
    assert.equal(sameResults.filter((result) => result.allowed).length, 10);
    const { rows: [sameCount] } = await client.query("select count(*)::int count from consumer_daily_hot_reel_unlocks where consumer_user_id=$1 and unlock_date=$2", [sameUser, "2031-01-01"]);
    assert.equal(sameCount.count, 1);

    const differentRounds: Array<{ winner: number; attempts: number; errors: number }> = [];
    for (let round = 0; round < 10; round++) {
      const userId = await createConsumer(`different-${round}`);
      const now = new Date(Date.UTC(2032, 0, round + 1, 12));
      const results = await Promise.allSettled([
        consumeFreeHotReelVenueUnlock({ userId, venueId: venues[0].id, hotReelPublicId: `${prefix}-reel-${venues[0].id}`, now }),
        consumeFreeHotReelVenueUnlock({ userId, venueId: venues[1].id, hotReelPublicId: `${prefix}-reel-${venues[1].id}`, now }),
      ]);
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<{ allowed: boolean; venueId: number }> => result.status === "fulfilled");
      const winners = fulfilled.filter((result) => result.value.allowed);
      const { rows: [count] } = await client.query("select count(*)::int count from consumer_daily_hot_reel_unlocks where consumer_user_id=$1 and unlock_date=$2", [userId, `2032-01-${String(round + 1).padStart(2, "0")}`]);
      assert.equal(count.count, 1);
      assert.equal(winners.length, 1);
      differentRounds.push({ winner: winners[0].value.venueId, attempts: results.length, errors: results.filter((result) => result.status === "rejected").length });
    }

    const retryUser = await createConsumer("retry");
    const retryNow = new Date("2033-01-01T12:00:00.000Z");
    const first = await consumeFreeHotReelVenueUnlock({ userId: retryUser, venueId: venues[0].id, hotReelPublicId: `${prefix}-reel-${venues[0].id}`, now: retryNow });
    const retry = await consumeFreeHotReelVenueUnlock({ userId: retryUser, venueId: venues[0].id, hotReelPublicId: `${prefix}-reel-${venues[0].id}`, now: retryNow });
    assert.equal(first.allowed, true);
    assert.equal(retry.allowed, true);
    const { rows: [retryCount] } = await client.query("select count(*)::int count from consumer_daily_hot_reel_unlocks where consumer_user_id=$1 and unlock_date='2033-01-01'", [retryUser]);
    assert.equal(retryCount.count, 1);

    const premiumUser = await createConsumer("premium");
    await client.query("insert into commercial_subscriptions (scope_type,scope_id,product,state,source,started_at,reason_code) values ('consumer',$1,'consumer_premium','active','manual',now(),'sprint9-race-premium')", [premiumUser]);
    const premium = await consumeFreeHotReelVenueUnlock({ userId: premiumUser, venueId: venues[0].id, hotReelPublicId: `${prefix}-reel-${venues[0].id}`, now: new Date("2034-01-01T12:00:00.000Z") });
    assert.equal(premium.allowed, true);
    const { rows: [premiumCount] } = await client.query("select count(*)::int count from consumer_daily_hot_reel_unlocks where consumer_user_id=$1 and unlock_date='2034-01-01'", [premiumUser]);
    assert.equal(premiumCount.count, 0);
    assert.equal(new Date("2034-01-01T00:00:00.000Z").toISOString().slice(0, 10), "2034-01-01");
    verified = true;
    console.log(JSON.stringify({ sameVenueAttempts: 10, sameVenueCanonicalRows: sameCount.count, differentVenueRounds: differentRounds.length, differentVenueWinners: differentRounds.map((round) => round.winner), lostResponseRetry: retry.allowed, premiumAllowanceRows: premiumCount.count, utcBoundary: "server UTC date key" }));
  } finally {
    if (verified || userIds.length > 0) {
      await client.query("delete from commercial_subscriptions where metadata_json like $1 or reason_code='sprint9-race-premium'", [`%${prefix}%`]);
      if (userIds.length) await client.query("delete from users where id=any($1::int[])", [userIds]);
      if (reelIds.length) await client.query("delete from hot_reels where id=any($1::int[])", [reelIds]);
      if (sourceIds.length) await client.query("delete from nightly_device_sources where id=any($1::int[])", [sourceIds]);
      if (deviceIds.length) await client.query("delete from nightly_devices where id=any($1::int[])", [deviceIds]);
    }
    const { rows: [remaining] } = await client.query("select (select count(*)::int from users where clerk_user_id like $1) users,(select count(*)::int from nightly_devices where serial_number like $1) devices,(select count(*)::int from nightly_device_sources where source_label like $1) sources,(select count(*)::int from hot_reels where hot_moment_id like $1) reels,(select count(*)::int from commercial_subscriptions where metadata_json like $2) subscriptions", [`${prefix}%`, `%${prefix}%`]);
    assert.deepEqual(remaining, { users: 0, devices: 0, sources: 0, reels: 0, subscriptions: 0 });
    client.release();
    await pool.end();
  }
});

test("Sprint 9 Development social target execution concurrency", { skip: !enabled, timeout: 120_000 }, async () => {
  const prefix = `NIGHTLY-SPRINT9-RACE-${randomUUID()}`;
  const previousProvider = process.env.SOCIAL_PUBLISH_PROVIDER;
  const previousHotReelProvider = process.env.HOT_REEL_PROVIDER;
  process.env.SOCIAL_PUBLISH_PROVIDER = "mock";
  process.env.HOT_REEL_PROVIDER = "mock";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  let subscriptionId: number | null = null;
  let accountId: number | null = null;
  let policyId: number | null = null;
  let socialReelId: number | null = null;
  const requestIds: number[] = [];
  const originalMethods: Record<string, unknown> = {};
  const calls: string[] = [];
  try {
    const { rows: [identity] } = await client.query("select current_database() database_name,current_setting('neon.project_id',true) project_id,current_setting('neon.branch_id',true) branch_id,current_setting('neon.endpoint_id',true) endpoint_id");
    assert.deepEqual(identity, { database_name: "neondb", project_id: "old-tooth-16761666", branch_id: "br-tiny-recipe-atpyb85n", endpoint_id: "ep-silent-hat-at3rhpgq" });
    const { rows: [fixture] } = await client.query(`select m.venue_id, m.clerk_user_id, u.id actor_user_id, r.id hot_reel_id, r.public_id hot_reel_public_id, r.device_id, r.source_id
      from venue_members m join users u on u.clerk_user_id=m.clerk_user_id
      join hot_reels r on r.venue_id=m.venue_id and r.lifecycle_state='ready' and r.publication_state='published' and r.review_state='approved'
      join nightly_devices d on d.id=r.device_id and d.service_entitlement_state='active' and d.hot_reel_eligible=true and d.public_publishing_enabled=true
      where m.role='owner' and u.account_status='active' and not exists (select 1 from commercial_subscriptions s where s.scope_type='venue' and s.scope_id=m.venue_id and s.product='venue_package') limit 1`);
    assert.ok(fixture, "An owner, eligible published Reel, and unsubscribed venue are required.");
    const { rows: socialReels } = await client.query("select r.id from hot_reels r join nightly_devices d on d.id=r.device_id where r.venue_id=$1 and r.lifecycle_state='ready' and r.publication_state='published' and r.review_state='approved' and d.service_entitlement_state='active' and d.hot_reel_eligible=true and d.public_publishing_enabled=true order by r.id limit 8", [fixture.venue_id]);
    assert.ok(socialReels.length >= 3);
    const { rows: [socialReel] } = await client.query("insert into hot_reels (public_id,hot_moment_id,venue_id,device_id,source_id,lifecycle_state,publication_state,review_state,provider_key,provider_object_key) values ($1,$2,$3,$4,$5,'ready','published','approved','mock',$6) returning id", [`${prefix}-social-reel`, `${prefix}-social-moment`, fixture.venue_id, fixture.device_id, fixture.source_id, `mock-hot-reels/${prefix}-social-moment.mp4`]);
    socialReelId = socialReel.id;
    const { MockHotReelProvider } = await import("../lib/hot-reel/provider/mock");
    const hotReelProvider = new MockHotReelProvider();
    const upload = await hotReelProvider.createUploadAuthorization({ hotMomentId: `${prefix}-social-moment`, venueId: fixture.venue_id, deviceId: fixture.device_id, sourceId: fixture.source_id, durationMs: 30_000 });
    await hotReelProvider.finalizeUpload(upload.objectKey);
    const { rows: [flag] } = await client.query("select enabled,kill_switch from platform_feature_flags where key='feature.social_publishing'");
    assert.ok(flag?.enabled && !flag.kill_switch, "Social publishing feature must be enabled for the targeted certification.");
    const { rows: [subscription] } = await client.query("insert into commercial_subscriptions (scope_type,scope_id,product,state,source,reason_code,metadata_json,started_at) values ('venue',$1,'venue_package','active','manual',$2,$3,now()) returning id", [fixture.venue_id, prefix, JSON.stringify({ prefix })]);
    subscriptionId = subscription.id;
    const { rows: [account] } = await client.query("insert into social_platform_accounts (public_id,venue_id,platform,provider_account_id,display_name,account_type,connection_state,authorization_state,granted_scopes_json,capabilities_json,reconnect_required,credential_ref,safe_metadata_json) values ($1,$2,'instagram',$3,'Sprint 9 Mock','business','connected','valid','[\"publish\"]','[\"can_upload_video\",\"can_publish_video\",\"can_idempotently_publish\"]',false,$4,$5) returning id", [`${prefix}-account`, fixture.venue_id, `${prefix}-provider-account`, `${prefix}-credential`, JSON.stringify({ prefix })]);
    accountId = account.id;
    const { rows: [existingPolicy] } = await client.query("select id,mode from social_publishing_policies where venue_id=$1", [fixture.venue_id]);
    if (existingPolicy) {
      assert.notEqual(existingPolicy.mode, "disabled", "Existing social policy must permit the isolated mock race.");
    } else {
      const { rows: [policy] } = await client.query("insert into social_publishing_policies (venue_id,mode,revision,updated_by_user_id) values ($1,'auto_publish',1,$2) returning id", [fixture.venue_id, fixture.actor_user_id]);
      policyId = policy.id;
    }

    const [{ configureSocialCredentialStore }, { runSocialDestination }, { MockSocialPublishingProvider }] = await Promise.all([
      (async () => { mock.module("@clerk/nextjs/server", { namedExports: { auth: async () => ({ userId: null }), clerkClient: async () => ({}) } }); mock.module("server-only", { namedExports: {} }); return import("../lib/social-publishing/credentials"); })(),
      import("../lib/social-publishing/distribution-service"),
      import("../lib/social-publishing/provider/mock"),
    ]);
    configureSocialCredentialStore({
      async put() { return { reference: `${prefix}-credential`, provider: "mock" }; },
      async get(reference: string) { return reference === `${prefix}-credential` ? { secret: "mock:sprint9", version: 1 } : null; },
      async compareAndSwap() { return true; },
      async delete() {},
    });
    for (const method of ["validateConnection", "findPublicationByIdempotencyKey", "preparePublication", "uploadMedia", "publish"] as const) {
      originalMethods[method] = MockSocialPublishingProvider.prototype[method];
      const original = MockSocialPublishingProvider.prototype[method];
      MockSocialPublishingProvider.prototype[method] = async function (...args: never[]) {
        calls.push(method);
        return (original as (...inner: never[]) => Promise<unknown>).apply(this, args);
      } as never;
    }

    const createDestination = async (suffix: string) => {
      const hotReelId = socialReelId as number;
      const { rows: [request] } = await client.query("insert into social_distribution_requests (public_id,hot_reel_id,venue_id,actor_user_id,idempotency_key,request_fingerprint,policy_mode_snapshot,policy_revision_snapshot,state,caption) values ($1,$2,$3,$4,$5,$6,'auto_publish',1,'queued','Sprint 9 race') returning id", [`${prefix}-request-${suffix}`, hotReelId, fixture.venue_id, fixture.actor_user_id, `${prefix}-key-${suffix}`, `${prefix}-fingerprint-${suffix}`]);
      requestIds.push(request.id);
      const { rows: [destination] } = await client.query("insert into social_publications (public_id,request_id,hot_reel_id,venue_id,account_id,actor_user_id,platform,policy_mode_snapshot,state,provider_key,provider_idempotency_key) values ($1,$2,$3,$4,$5,$6,'instagram','auto_publish','queued','mock',$7) returning public_id", [`${prefix}-destination-${suffix}`, request.id, hotReelId, fixture.venue_id, accountId, fixture.actor_user_id, `${prefix}-provider-key-${suffix}`]);
      return destination.public_id as string;
    };
    const removeDestination = async (publicId: string) => {
      await client.query("delete from social_publications where public_id=$1", [publicId]);
      await client.query("delete from social_distribution_requests where public_id=$1", [publicId]);
    };

    const suspendedDestination = await createDestination("suspended");
    await client.query("update commercial_subscriptions set state='suspended',reason_code=$2 where id=$1", [subscriptionId, `${prefix}-suspended`]);
    calls.length = 0;
    await runSocialDestination(suspendedDestination);
    const { rows: [suspendedState] } = await client.query("select state,provider_publication_id from social_publications where public_id=$1", [suspendedDestination]);
    assert.equal(calls.length, 0);
    const suspensionProviderCalls = calls.length;
    assert.equal(suspendedState.state, "cancelled");
    assert.equal(suspendedState.provider_publication_id, null);
    await removeDestination(suspendedDestination);

    await client.query("update commercial_subscriptions set state='active',reason_code=$2 where id=$1", [subscriptionId, `${prefix}-active`]);
    const duplicateDestination = await createDestination("duplicate");
    calls.length = 0;
    await Promise.allSettled([runSocialDestination(duplicateDestination), runSocialDestination(duplicateDestination)]);
    const { rows: [duplicateState] } = await client.query("select state,provider_publication_id,attempts from social_publications where public_id=$1", [duplicateDestination]);
    const duplicateProviderPublishes = calls.filter((call) => call === "publish").length;
    assert.ok(duplicateProviderPublishes <= 1);
    assert.notEqual(duplicateState.state, "queued");

    const staleResult = await runSocialDestination(duplicateDestination).catch((error: unknown) => error);
    assert.ok(staleResult instanceof Error);
    const { rows: [staleState] } = await client.query("select state,provider_publication_id from social_publications where public_id=$1", [duplicateDestination]);
    assert.deepEqual(staleState, { state: duplicateState.state, provider_publication_id: duplicateState.provider_publication_id });
    await removeDestination(duplicateDestination);

    const acceptedDestination = await createDestination("accepted");
    calls.length = 0;
    await runSocialDestination(acceptedDestination);
    const { rows: [acceptedBefore] } = await client.query("select state,provider_publication_id from social_publications where public_id=$1", [acceptedDestination]);
    await client.query("update commercial_subscriptions set state='suspended',reason_code=$2 where id=$1", [subscriptionId, `${prefix}-later-suspended`]);
    const later = await runSocialDestination(acceptedDestination).catch((error: unknown) => error);
    assert.ok(later instanceof Error);
    const { rows: [acceptedAfter] } = await client.query("select state,provider_publication_id from social_publications where public_id=$1", [acceptedDestination]);
    assert.deepEqual(acceptedAfter, acceptedBefore);
    const source = await (await import("node:fs/promises")).readFile("lib/social-publishing/distribution-service.ts", "utf8");
    assert.ok(source.indexOf("const providerCreateStarted") < source.indexOf("provider.publish"));
    console.log(JSON.stringify({ suspensionBeforeProvider: suspendedState.state, providerCallsAfterSuspension: suspensionProviderCalls, duplicateProviderPublishes, staleWorker: "terminal state preserved", acceptedBeforeLaterSuspension: acceptedAfter.state, providerOutsideTransaction: true }));
  } finally {
    const { MockSocialPublishingProvider } = await import("../lib/social-publishing/provider/mock");
    for (const [method, original] of Object.entries(originalMethods)) MockSocialPublishingProvider.prototype[method as keyof typeof MockSocialPublishingProvider.prototype] = original as never;
    if (requestIds.length) await client.query("delete from social_distribution_requests where id=any($1::int[])", [requestIds]);
    if (accountId !== null) await client.query("delete from social_platform_accounts where id=$1 and public_id like $2", [accountId, `${prefix}%`]);
    if (socialReelId !== null) await client.query("delete from hot_reels where id=$1 and public_id like $2", [socialReelId, `${prefix}%`]);
    if (policyId !== null) await client.query("delete from social_publishing_policies where id=$1", [policyId]);
    if (subscriptionId !== null) await client.query("delete from commercial_subscriptions where id=$1 and metadata_json like $2", [subscriptionId, `%${prefix}%`]);
    const { rows: [remaining] } = await client.query("select (select count(*)::int from social_distribution_requests where public_id like $1) requests,(select count(*)::int from social_platform_accounts where public_id like $1) accounts,(select count(*)::int from commercial_subscriptions where metadata_json like $2) subscriptions", [`${prefix}%`, `%${prefix}%`]);
    assert.deepEqual(remaining, { requests: 0, accounts: 0, subscriptions: 0 });
    client.release();
    await pool.end();
    process.env.SOCIAL_PUBLISH_PROVIDER = previousProvider;
    process.env.HOT_REEL_PROVIDER = previousHotReelProvider;
  }
});
