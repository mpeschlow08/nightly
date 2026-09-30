import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { COMMERCIAL_SERVICE_PURPOSES, SERVICE_CAPABILITIES_BY_PURPOSE, deviceOfflineEntitlementExpiresAt, evaluateSubscriptionCapability, utcAllowanceDate } from "@/lib/commercial-entitlements/policy";

const now = new Date("2026-09-30T12:00:00.000Z");

test("venue package grants its single catalog of venue and device capabilities", () => {
  const allowed = evaluateSubscriptionCapability({
    scope: "venue",
    capability: "venue.social_publishing",
    subscription: { product: "venue_package", state: "active", startsAt: new Date(now.getTime() - 1000), trialEndsAt: null, graceUntil: null, endsAt: null },
    now,
  });
  const mismatchedProduct = evaluateSubscriptionCapability({
    scope: "venue",
    capability: "consumer.hot_reels_unlimited",
    subscription: { product: "venue_package", state: "active", startsAt: new Date(now.getTime() - 1000), trialEndsAt: null, graceUntil: null, endsAt: null },
    now,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reasonCode, "active_subscription");
  assert.equal(mismatchedProduct.allowed, false);
  assert.equal(mismatchedProduct.reasonCode, "capability_disabled");
});

test("commercial trial, grace, suspension, cancellation and expiry have bounded evaluation", () => {
  const subscription = (state: "trialing" | "grace_period" | "suspended" | "cancel_pending" | "expired", overrides: Partial<{ trialEndsAt: Date | null; graceUntil: Date | null; endsAt: Date | null }> = {}) => ({
    product: "consumer_premium" as const,
    state,
    startsAt: new Date(now.getTime() - 60_000),
    trialEndsAt: null,
    graceUntil: null,
    endsAt: null,
    ...overrides,
  });
  const evaluate = (value: ReturnType<typeof subscription>) => evaluateSubscriptionCapability({ scope: "consumer", capability: "consumer.ai_concierge", subscription: value, now });
  assert.deepEqual([evaluate(subscription("trialing", { trialEndsAt: new Date(now.getTime() + 60_000) })).allowed, evaluate(subscription("trialing", { trialEndsAt: now })).reasonCode], [true, "trial_expired"]);
  assert.deepEqual([evaluate(subscription("grace_period", { graceUntil: new Date(now.getTime() + 60_000) })).allowed, evaluate(subscription("grace_period", { graceUntil: now })).allowed], [true, false]);
  assert.equal(evaluate(subscription("suspended")).reasonCode, "suspended");
  assert.equal(evaluate(subscription("cancel_pending")).allowed, true);
  assert.equal(evaluate(subscription("cancel_pending", { endsAt: now })).reasonCode, "expired");
  assert.equal(evaluateSubscriptionCapability({ scope: "consumer", capability: "consumer.ai_concierge", subscription: null, now }).reasonCode, "subscription_required");
});

test("free allowance date is server-UTC deterministic and device offline entitlement is bounded", () => {
  assert.equal(utcAllowanceDate(new Date("2026-09-30T23:59:59.999Z")), "2026-09-30");
  assert.equal(utcAllowanceDate(new Date("2026-10-01T00:00:00.000Z")), "2026-10-01");
  assert.equal(deviceOfflineEntitlementExpiresAt({ issuedAt: now, configuredHours: 72 }).toISOString(), "2026-10-03T12:00:00.000Z");
  assert.throws(() => deviceOfflineEntitlementExpiresAt({ issuedAt: now, configuredHours: 0 }), /device_offline_entitlement_policy_invalid/);
});

test("service authorization purposes expose only their bounded capability subsets", () => {
  assert.deepEqual(COMMERCIAL_SERVICE_PURPOSES, ["device_diagnostics", "device_reprovision", "commissioning", "sales_demo", "commercial_support"]);
  assert.deepEqual(SERVICE_CAPABILITIES_BY_PURPOSE.device_diagnostics, ["service.device_diagnostics"]);
  assert.equal(SERVICE_CAPABILITIES_BY_PURPOSE.device_reprovision.includes("service.device_reprovision"), true);
  assert.equal(SERVICE_CAPABILITIES_BY_PURPOSE.sales_demo.includes("service.device_reprovision"), false);
  assert.equal(SERVICE_CAPABILITIES_BY_PURPOSE.commercial_support.includes("service.commissioning"), false);
});

test("0035 journal is additive, ordered, and aligned with its commercial tables", async () => {
  const [journalText, schema, migration] = await Promise.all([
    readFile("drizzle/meta/_journal.json", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0035_commercial_entitlement_foundation.sql", "utf8"),
  ]);
  const journal = JSON.parse(journalText) as { entries: Array<{ idx: number; when: number; tag: string }> };
  const entries = journal.entries.filter((entry) => entry.tag === "0035_commercial_entitlement_foundation");
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], { idx: 35, version: "7", when: 1793000001005, tag: "0035_commercial_entitlement_foundation", breakpoints: true });
  assert.equal(journal.entries[34].tag, "0034_social_publishing_integrity_hardening");
  for (const table of ["commercial_subscriptions", "commercial_entitlement_grants", "commercial_service_authorizations", "consumer_daily_hot_reel_unlocks"]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table} \\(`));
    assert.match(schema, new RegExp(`export const ${table.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())} = pgTable`));
  }
  assert.match(migration, /consumer_daily_hot_reel_unlocks_user_day_unique/);
  assert.match(migration, /commercial_service_authorizations_purpose_capability_check/);
});

test("Consumer playback does not consume a daily unlock until provider authorization succeeds", async () => {
  const route = await readFile("app/api/consumer/hot-reels/[publicId]/playback/route.ts", "utf8");
  const playbackAuthorization = route.indexOf("const playback = await authorizeHotReelPlayback");
  const allowanceConsumption = route.indexOf("const unlock = await consumeFreeHotReelVenueUnlock");
  assert.ok(playbackAuthorization >= 0 && allowanceConsumption > playbackAuthorization);
  assert.ok(route.indexOf("if (!playback.allowed)") < allowanceConsumption);
  assert.match(route, /hotReelPublicId: publicId/);
});

test("entitlement queries sharing a transaction client remain sequential", async () => {
  const [service, social] = await Promise.all([
    readFile("lib/commercial-entitlements/service.ts", "utf8"),
    readFile("lib/social-publishing/distribution-service.ts", "utf8"),
  ]);
  const consumerUnlock = service.slice(service.indexOf("export async function consumeFreeHotReelVenueUnlock"), service.indexOf("const commercialTransitions"));
  const providerStart = social.slice(social.indexOf("async function beginProviderCreate"), social.indexOf("async function markDestinationProcessing"));
  assert.ok(consumerUnlock.length > 0);
  assert.ok(providerStart.length > 0);
  assert.doesNotMatch(consumerUnlock, /Promise\.all/);
  assert.doesNotMatch(providerStart, /Promise\.all/);
});