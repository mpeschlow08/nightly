import "server-only";

import { and, desc, eq, gt, inArray, lte, or, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { auditLogs, commercialEntitlementGrants, commercialServiceAuthorizations, commercialSubscriptions, consumerDailyHotReelUnlocks, djProfiles, hotReels, nightlyDevices, users, venues } from "@/db/schema";
import { CAPABILITIES_BY_PRODUCT, COMMERCIAL_CAPABILITIES, SERVICE_CAPABILITIES_BY_PURPOSE, configuredDeviceOfflineEntitlementHours, evaluateSubscriptionCapability, utcAllowanceDate } from "./policy";
import type { CommercialCapability, CommercialProduct, CommercialScope, CommercialServicePurpose, CommercialSubscriptionSnapshot, EntitlementDecision } from "./policy";

type CommercialTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CommercialClient = typeof db | CommercialTx;

export class CommercialEntitlementError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "CommercialEntitlementError";
  }
}

type EvaluationInput = {
  scope: CommercialScope;
  scopeId: number;
  capability: CommercialCapability;
  actorUserId?: number;
  serviceAuthorizationId?: string;
  servicePurpose?: CommercialServicePurpose;
  now?: Date;
};

function productForScope(scope: CommercialScope): CommercialProduct | null {
  if (scope === "venue" || scope === "device") return "venue_package";
  if (scope === "consumer") return "consumer_premium";
  if (scope === "artist") return "artist_subscription";
  return null;
}

async function resolveScope(client: CommercialClient, scope: CommercialScope, scopeId: number) {
  if (!Number.isSafeInteger(scopeId) || scopeId <= 0) return { exists: false, parentVenueId: null as number | null, suspended: false };
  if (scope === "venue") {
    const [venue] = await client.select({ id: venues.id, suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, scopeId)).limit(1);
    return { exists: Boolean(venue), parentVenueId: venue?.id ?? null, suspended: venue?.suspendedAt != null };
  }
  if (scope === "device") {
    const [device] = await client.select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, lifecycleState: nightlyDevices.lifecycleState }).from(nightlyDevices).where(eq(nightlyDevices.id, scopeId)).limit(1);
    return { exists: Boolean(device), parentVenueId: device?.venueId ?? null, suspended: device?.lifecycleState === "revoked" || device?.lifecycleState === "retired" };
  }
  if (scope === "consumer") {
    const [user] = await client.select({ id: users.id, accountStatus: users.accountStatus }).from(users).where(eq(users.id, scopeId)).limit(1);
    return { exists: Boolean(user && user.accountStatus === "active"), parentVenueId: null, suspended: user?.accountStatus !== "active" };
  }
  if (scope === "artist") {
    const [artist] = await client.select({ id: djProfiles.id, accountStatus: users.accountStatus }).from(djProfiles).innerJoin(users, eq(users.id, djProfiles.userId)).where(eq(djProfiles.id, scopeId)).limit(1);
    return { exists: Boolean(artist && artist.accountStatus === "active"), parentVenueId: null, suspended: artist?.accountStatus !== "active" };
  }
  return { exists: false, parentVenueId: null, suspended: false };
}

async function evaluateWithClient(client: CommercialClient, input: EvaluationInput): Promise<EntitlementDecision> {
  const now = input.now ?? new Date();
  const scopeRecord = await resolveScope(client, input.scope, input.scopeId);
  const serviceCapability = input.capability.startsWith("service.");
  if (!scopeRecord.exists) {
    return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "none", source: "none", reasonCode: "scope_mismatch", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
  }
  if (scopeRecord.suspended && !serviceCapability) {
    return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "none", source: "none", reasonCode: "scope_unavailable", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
  }
  if (!serviceCapability && (input.scope === "device" || input.scope === "venue") && scopeRecord.parentVenueId) {
    const [venue] = await client.select({ suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, scopeRecord.parentVenueId)).limit(1);
    if (!venue || venue.suspendedAt) return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "suspended", source: "none", reasonCode: "suspended", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
  }

  if (input.capability.startsWith("service.")) {
    if (!input.actorUserId || !input.serviceAuthorizationId || !input.servicePurpose) return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "none", source: "none", reasonCode: "service_auth_expired", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
    const [authorization] = await client.select().from(commercialServiceAuthorizations).where(and(
      eq(commercialServiceAuthorizations.publicId, input.serviceAuthorizationId),
      eq(commercialServiceAuthorizations.actorUserId, input.actorUserId),
      eq(commercialServiceAuthorizations.scopeType, input.scope),
      eq(commercialServiceAuthorizations.scopeId, input.scopeId),
      eq(commercialServiceAuthorizations.purpose, input.servicePurpose),
    )).limit(1);
    if (!authorization) return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "none", source: "none", reasonCode: "service_auth_expired", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
    if (authorization.revokedAt) return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "suspended", source: "none", reasonCode: "service_auth_revoked", expiresAt: authorization.expiresAt, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
    const valid = authorization.issuedAt <= now && authorization.expiresAt > now && authorization.capabilities.includes(input.capability);
    return { allowed: valid, capability: input.capability, scope: input.scope, commercialState: valid ? "active" : "expired", source: valid ? "service_authorization" : "none", reasonCode: valid ? "service_authorization" : "service_auth_expired", expiresAt: authorization.expiresAt, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
  }

  const grantScopes: Array<{ scope: CommercialScope; id: number }> = [{ scope: input.scope, id: input.scopeId }];
  if (input.scope === "device" && scopeRecord.parentVenueId) grantScopes.push({ scope: "venue", id: scopeRecord.parentVenueId });
  const grantConditions = grantScopes.map(({ scope, id }) => and(eq(commercialEntitlementGrants.scopeType, scope), eq(commercialEntitlementGrants.scopeId, id)));
  const [grant] = await client.select().from(commercialEntitlementGrants).where(and(
    or(...grantConditions),
    eq(commercialEntitlementGrants.capability, input.capability),
    lte(commercialEntitlementGrants.startsAt, now),
    or(isNull(commercialEntitlementGrants.expiresAt), gt(commercialEntitlementGrants.expiresAt, now)),
    isNull(commercialEntitlementGrants.revokedAt),
  )).orderBy(desc(commercialEntitlementGrants.createdAt)).limit(1);
  if (grant) {
    const product = productForScope(input.scope);
    const subscriptionScope: CommercialScope = input.scope === "device" ? "venue" : input.scope;
    const subscriptionId = input.scope === "device" ? scopeRecord.parentVenueId : input.scopeId;
    const [subscription] = product && subscriptionId ? await client.select({ state: commercialSubscriptions.state, endsAt: commercialSubscriptions.endsAt, graceUntil: commercialSubscriptions.graceUntil, trialEndsAt: commercialSubscriptions.trialEndsAt })
      .from(commercialSubscriptions).where(and(eq(commercialSubscriptions.scopeType, subscriptionScope), eq(commercialSubscriptions.scopeId, subscriptionId), eq(commercialSubscriptions.product, product))).limit(1) : [];
    return { allowed: true, capability: input.capability, scope: input.scope, commercialState: subscription?.state ?? "none", source: "manual_grant", reasonCode: "manual_grant", expiresAt: grant.expiresAt, graceUntil: subscription?.graceUntil ?? null, trialEndsAt: subscription?.trialEndsAt ?? null, evaluatedAt: now };
  }

  const product = productForScope(input.scope);
  if (!product) return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "none", source: "none", reasonCode: "scope_mismatch", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
  const subscriptionScope: CommercialScope = input.scope === "device" ? "venue" : input.scope;
  const subscriptionId = input.scope === "device" ? scopeRecord.parentVenueId : input.scopeId;
  if (!subscriptionId) return { allowed: false, capability: input.capability, scope: input.scope, commercialState: "none", source: "none", reasonCode: "scope_mismatch", expiresAt: null, graceUntil: null, trialEndsAt: null, evaluatedAt: now };
  const [row] = await client.select().from(commercialSubscriptions).where(and(
    eq(commercialSubscriptions.scopeType, subscriptionScope),
    eq(commercialSubscriptions.scopeId, subscriptionId),
    eq(commercialSubscriptions.product, product),
  )).limit(1);
  const snapshot: CommercialSubscriptionSnapshot | null = row ? { product: row.product, state: row.state, startsAt: row.startedAt, trialEndsAt: row.trialEndsAt, graceUntil: row.graceUntil, endsAt: row.endsAt } : null;
  return evaluateSubscriptionCapability({ scope: input.scope, capability: input.capability, subscription: snapshot, now });
}

export function evaluateCommercialEntitlement(input: EvaluationInput): Promise<EntitlementDecision> {
  return evaluateWithClient(db, input);
}

export function evaluateCommercialEntitlementInTransaction(tx: CommercialTx, input: EvaluationInput): Promise<EntitlementDecision> {
  return evaluateWithClient(tx, input);
}

export async function evaluateAuthorizedServiceAccess(input: { clerkUserId: string; scope: "venue" | "device"; scopeId: number; capability: CommercialCapability; purpose: CommercialServicePurpose; authorizationId: string; now?: Date }) {
  const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.clerkUserId, input.clerkUserId), eq(users.accountStatus, "active"))).limit(1);
  if (!user) throw new CommercialEntitlementError("forbidden", 403);
  if (!COMMERCIAL_CAPABILITIES.includes(input.capability) || !SERVICE_CAPABILITIES_BY_PURPOSE[input.purpose].includes(input.capability)) throw new CommercialEntitlementError("scope_mismatch", 403);
  return evaluateCommercialEntitlement({ scope: input.scope, scopeId: input.scopeId, capability: input.capability, actorUserId: user.id, servicePurpose: input.purpose, serviceAuthorizationId: input.authorizationId, now: input.now });
}

export async function getCommercialSubscriptionStatus(scope: CommercialScope, scopeId: number, now = new Date()) {
  const scopeRecord = await resolveScope(db, scope, scopeId);
  if (!scopeRecord.exists) throw new CommercialEntitlementError("scope_mismatch", 404);
  const product = productForScope(scope);
  const subscriptionScope: CommercialScope = scope === "device" ? "venue" : scope;
  const subscriptionId = scope === "device" ? scopeRecord.parentVenueId : scopeId;
  const [subscription] = product && subscriptionId ? await db.select().from(commercialSubscriptions).where(and(
    eq(commercialSubscriptions.scopeType, subscriptionScope), eq(commercialSubscriptions.scopeId, subscriptionId), eq(commercialSubscriptions.product, product),
  )).limit(1) : [];
  const capabilities = product ? CAPABILITIES_BY_PRODUCT[product] : [];
  const decisions = await Promise.all(capabilities.map((capability) => evaluateCommercialEntitlement({ scope, scopeId, capability, now })));
  return {
    scope,
    scopeId,
    product,
    state: subscription?.state ?? "expired",
    scopeAvailable: !scopeRecord.suspended,
    source: subscription?.source ?? "none",
    revision: subscription?.revision ?? 0,
    startedAt: subscription?.startedAt.toISOString() ?? null,
    trialStartedAt: subscription?.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
    graceUntil: subscription?.graceUntil?.toISOString() ?? null,
    cancelAt: subscription?.cancelAt?.toISOString() ?? null,
    endsAt: subscription?.endsAt?.toISOString() ?? null,
    reasonCode: scopeRecord.suspended ? "scope_unavailable" : subscription?.reasonCode ?? "subscription_required",
    capabilities: decisions.map((decision) => ({ capability: decision.capability, allowed: decision.allowed, reasonCode: decision.reasonCode, source: decision.source, expiresAt: decision.expiresAt?.toISOString() ?? null })),
    evaluatedAt: now.toISOString(),
  };
}

export async function listCommercialSubscriptions(limit = 100) {
  const bounded = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 100;
  const rows = await db.select({ id: commercialSubscriptions.id, scopeType: commercialSubscriptions.scopeType, scopeId: commercialSubscriptions.scopeId, product: commercialSubscriptions.product, state: commercialSubscriptions.state, source: commercialSubscriptions.source, revision: commercialSubscriptions.revision, startedAt: commercialSubscriptions.startedAt, trialEndsAt: commercialSubscriptions.trialEndsAt, graceUntil: commercialSubscriptions.graceUntil, endsAt: commercialSubscriptions.endsAt, reasonCode: commercialSubscriptions.reasonCode, updatedAt: commercialSubscriptions.updatedAt })
    .from(commercialSubscriptions).orderBy(desc(commercialSubscriptions.updatedAt)).limit(bounded);
  return rows.map((row) => ({ ...row, startedAt: row.startedAt.toISOString(), trialEndsAt: row.trialEndsAt?.toISOString() ?? null, graceUntil: row.graceUntil?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() }));
}

export async function ensureConsumerPremiumTrial(userId: number, now = new Date()) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isFinite(now.getTime())) throw new CommercialEntitlementError("invalid_request", 400);
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id, clerkUserId: users.clerkUserId, accountStatus: users.accountStatus, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (!user || user.accountStatus !== "active") throw new CommercialEntitlementError("forbidden", 403);
    const trialStartedAt = user.createdAt;
    const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const trialState = trialEndsAt > now ? "trialing" as const : "expired" as const;
    const [inserted] = await tx.insert(commercialSubscriptions).values({
      scopeType: "consumer", scopeId: userId, product: "consumer_premium", state: trialState, source: "trial",
      startedAt: trialStartedAt, trialStartedAt, trialEndsAt, createdByUserId: userId, updatedByUserId: userId,
      reasonCode: trialState === "trialing" ? "new_consumer_trial" : "trial_elapsed_before_first_entitlement_access",
    }).onConflictDoNothing({ target: [commercialSubscriptions.scopeType, commercialSubscriptions.scopeId, commercialSubscriptions.product] }).returning();
    if (inserted) {
      await tx.insert(auditLogs).values({ actorClerkUserId: user.clerkUserId, actorRole: "consumer", entityType: "commercial_subscription", entityId: `consumer:${userId}:consumer_premium`, action: trialState === "trialing" ? "commercial_trial_started" : "commercial_trial_expired", nextValuesJson: JSON.stringify({ state: trialState, startsAt: trialStartedAt.toISOString(), trialEndsAt: trialEndsAt.toISOString() }), metadataJson: JSON.stringify({ source: "new_consumer_trial" }) });
    }
    const [subscription] = await tx.select().from(commercialSubscriptions).where(and(
      eq(commercialSubscriptions.scopeType, "consumer"), eq(commercialSubscriptions.scopeId, userId), eq(commercialSubscriptions.product, "consumer_premium"),
    )).limit(1);
    return subscription;
  });
}

export async function getConsumerCommercialStatus(userId: number, now = new Date()) {
  await ensureConsumerPremiumTrial(userId, now);
  const premium = await evaluateCommercialEntitlement({ scope: "consumer", scopeId: userId, capability: "consumer.hot_reels_unlimited", now });
  const unlockDate = utcAllowanceDate(now);
  const [unlock] = await db.select({ venueId: consumerDailyHotReelUnlocks.venueId }).from(consumerDailyHotReelUnlocks).where(and(
    eq(consumerDailyHotReelUnlocks.consumerUserId, userId), eq(consumerDailyHotReelUnlocks.unlockDate, unlockDate),
  )).limit(1);
  return { premiumAllowed: premium.allowed, premiumReasonCode: premium.reasonCode, trialEndsAt: premium.trialEndsAt?.toISOString() ?? null, unlockDate, freeVenueUnlockAvailable: premium.allowed || !unlock, unlockedVenueId: unlock?.venueId ?? null };
}

export async function consumeFreeHotReelVenueUnlock(input: { userId: number; venueId: number; hotReelPublicId?: string; now?: Date }) {
  const now = input.now ?? new Date();
  await ensureConsumerPremiumTrial(input.userId, now);
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id, clerkUserId: users.clerkUserId, accountStatus: users.accountStatus }).from(users).where(eq(users.id, input.userId)).for("update").limit(1);
    if (!user || user.accountStatus !== "active") throw new CommercialEntitlementError("forbidden", 403);
    const [venue] = await tx.select({ id: venues.id, publicationStatus: venues.publicationStatus, suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, input.venueId)).for("share").limit(1);
    if (!venue || venue.publicationStatus !== "published" || venue.suspendedAt) throw new CommercialEntitlementError("commercial_scope_unavailable", 404);
    const venueEntitlement = await evaluateWithClient(tx, { scope: "venue", scopeId: input.venueId, capability: "venue.hot_reels", now });
    if (!venueEntitlement.allowed) throw new CommercialEntitlementError("entitlement_required", 403);
    const [availableReel] = await tx.select({ id: hotReels.id, deviceId: hotReels.deviceId }).from(hotReels)
      .innerJoin(nightlyDevices, eq(nightlyDevices.id, hotReels.deviceId))
      .where(and(eq(hotReels.venueId, input.venueId), ...(input.hotReelPublicId ? [eq(hotReels.publicId, input.hotReelPublicId)] : []), eq(hotReels.lifecycleState, "ready"), eq(hotReels.reviewState, "approved"), eq(hotReels.publicationState, "published"), eq(nightlyDevices.serviceEntitlementState, "active"), isNull(nightlyDevices.serviceSuspendedAt), eq(nightlyDevices.contentEligibility, "approved"), eq(nightlyDevices.hotReelEligible, true), eq(nightlyDevices.publicPublishingEnabled, true)))
      .limit(1);
    if (!availableReel) throw new CommercialEntitlementError("venue_content_unavailable", 404);
    const deviceCapture = await evaluateWithClient(tx, { scope: "device", scopeId: availableReel.deviceId, capability: "device.capture", now });
    const deviceMoments = await evaluateWithClient(tx, { scope: "device", scopeId: availableReel.deviceId, capability: "device.hot_moments", now });
    if (!deviceCapture.allowed || !deviceMoments.allowed) throw new CommercialEntitlementError("entitlement_required", 403);
    const premium = await evaluateWithClient(tx, { scope: "consumer", scopeId: input.userId, capability: "consumer.hot_reels_unlimited", now });
    if (premium.allowed) return { allowed: true, source: premium.source, reasonCode: premium.reasonCode, venueId: input.venueId, unlockDate: utcAllowanceDate(now) };
    const unlockDate = utcAllowanceDate(now);
    const [created] = await tx.insert(consumerDailyHotReelUnlocks).values({ consumerUserId: input.userId, unlockDate, venueId: input.venueId, createdAt: now })
      .onConflictDoNothing({ target: [consumerDailyHotReelUnlocks.consumerUserId, consumerDailyHotReelUnlocks.unlockDate] }).returning({ id: consumerDailyHotReelUnlocks.id });
    if (created) {
      await tx.insert(auditLogs).values({ actorClerkUserId: user.clerkUserId, actorRole: "consumer", entityType: "consumer_daily_hot_reel_unlock", entityId: `${input.userId}:${unlockDate}`, action: "consumer_free_hot_reel_venue_unlocked", nextValuesJson: JSON.stringify({ venueId: input.venueId, unlockDate }), metadataJson: JSON.stringify({ source: "free_allowance", timezone: "UTC" }) });
      return { allowed: true, source: "free_allowance", reasonCode: "free_allowance", venueId: input.venueId, unlockDate };
    }
    const [existing] = await tx.select({ venueId: consumerDailyHotReelUnlocks.venueId }).from(consumerDailyHotReelUnlocks).where(and(
      eq(consumerDailyHotReelUnlocks.consumerUserId, input.userId), eq(consumerDailyHotReelUnlocks.unlockDate, unlockDate),
    )).limit(1);
    if (existing?.venueId === input.venueId) return { allowed: true, source: "free_allowance", reasonCode: "free_allowance", venueId: input.venueId, unlockDate };
    return { allowed: false, source: "none", reasonCode: "free_allowance_used", venueId: existing?.venueId ?? null, unlockDate };
  });
}

const commercialTransitions: Readonly<Record<string, readonly string[]>> = {
  trialing: ["active", "grace_period", "suspended", "cancel_pending", "cancelled", "expired"],
  active: ["grace_period", "past_due", "suspended", "cancel_pending", "cancelled", "expired"],
  grace_period: ["active", "past_due", "suspended", "cancel_pending", "cancelled", "expired"],
  past_due: ["active", "grace_period", "suspended", "cancelled", "expired"],
  suspended: ["active", "cancelled", "expired"],
  cancel_pending: ["active", "cancelled", "expired"],
  cancelled: ["active", "expired"],
  expired: ["active"],
};

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function directiveForSubscription(input: { subscription: typeof commercialSubscriptions.$inferSelect | null; scopeUnavailable: boolean; deviceId: number; revision: number; now: Date; manualCapabilities?: string[]; manualGrantExpiresAt?: Date | null }) {
  const subscription = input.subscription;
  const capability = evaluateSubscriptionCapability({
    scope: "device",
    capability: "venue.hot_reels",
    subscription: subscription ? { product: subscription.product, state: subscription.state, startsAt: subscription.startedAt, trialEndsAt: subscription.trialEndsAt, graceUntil: subscription.graceUntil, endsAt: subscription.endsAt } : null,
    now: input.now,
  });
  const manualCapabilities = [...new Set(input.manualCapabilities ?? [])].sort();
  const subscriptionAllowed = capability.allowed;
  const allowed = (subscriptionAllowed || manualCapabilities.length > 0) && !input.scopeUnavailable;
  const state = subscriptionAllowed ? capability.commercialState : manualCapabilities.length ? "active" : capability.commercialState;
  const allowedCapabilities = allowed
    ? subscriptionAllowed ? [...CAPABILITIES_BY_PRODUCT.venue_package] : manualCapabilities
    : ["device.management" as const];
  const boundedEnd = [subscription?.endsAt, subscription?.trialEndsAt, subscription?.graceUntil, input.manualGrantExpiresAt]
    .filter((value): value is Date => value instanceof Date && value.getTime() > input.now.getTime())
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const offlineWindowEnd = allowed ? new Date(input.now.getTime() + configuredDeviceOfflineEntitlementHours() * 60 * 60 * 1000) : input.now;
  const offlineEntitlementExpiresAt = boundedEnd && boundedEnd < offlineWindowEnd ? boundedEnd : offlineWindowEnd;
  const refreshBy = new Date(Math.min(input.now.getTime() + 5 * 60 * 1000, offlineEntitlementExpiresAt.getTime()));
  return {
    commercialState: state,
    reasonCode: input.scopeUnavailable ? "scope_unavailable" : subscriptionAllowed ? capability.reasonCode : manualCapabilities.length ? "manual_grant" : capability.reasonCode,
    allowedCapabilities,
    revision: input.revision,
    subscriptionRevision: subscription?.revision ?? 0,
    issuedAt: input.now.toISOString(),
    refreshBy: refreshBy.toISOString(),
    offlineEntitlementExpiresAt: offlineEntitlementExpiresAt.toISOString(),
    managementAvailable: true,
  };
}

async function updateDeviceDirectiveInTransaction(tx: CommercialTx, input: { venueId: number; subscription: typeof commercialSubscriptions.$inferSelect | null; scopeUnavailable: boolean; now: Date; forceRevision?: boolean }) {
  const devices = await tx.select().from(nightlyDevices).where(eq(nightlyDevices.venueId, input.venueId)).for("update");
  const grants = devices.length ? await tx.select({ scopeType: commercialEntitlementGrants.scopeType, scopeId: commercialEntitlementGrants.scopeId, capability: commercialEntitlementGrants.capability, expiresAt: commercialEntitlementGrants.expiresAt })
    .from(commercialEntitlementGrants).where(and(or(
      and(eq(commercialEntitlementGrants.scopeType, "venue"), eq(commercialEntitlementGrants.scopeId, input.venueId)),
      and(eq(commercialEntitlementGrants.scopeType, "device"), inArray(commercialEntitlementGrants.scopeId, devices.map((device) => device.id))),
    ), lte(commercialEntitlementGrants.startsAt, input.now), or(isNull(commercialEntitlementGrants.expiresAt), gt(commercialEntitlementGrants.expiresAt, input.now)), isNull(commercialEntitlementGrants.revokedAt))) : [];
  for (const device of devices) {
    const oldState = parseJsonObject(device.serviceStateJson);
    const oldDirective = oldState.commercialDirective as Record<string, unknown> | undefined;
    const deviceGrants = grants.filter((grant) => grant.scopeType === "venue" && grant.scopeId === input.venueId || grant.scopeType === "device" && grant.scopeId === device.id);
    const candidate = directiveForSubscription({ subscription: input.subscription, scopeUnavailable: input.scopeUnavailable, deviceId: device.id, revision: device.serviceConfigRevision, now: input.now, manualCapabilities: deviceGrants.map((grant) => grant.capability), manualGrantExpiresAt: deviceGrants.map((grant) => grant.expiresAt).filter((value): value is Date => value !== null).sort((left,right)=>left.getTime()-right.getTime())[0] ?? null });
    const unchanged = !input.forceRevision && oldDirective?.commercialState === candidate.commercialState &&
      oldDirective?.subscriptionRevision === candidate.subscriptionRevision &&
      JSON.stringify(oldDirective?.allowedCapabilities) === JSON.stringify(candidate.allowedCapabilities) &&
      typeof oldDirective.offlineEntitlementExpiresAt === "string" && Date.parse(oldDirective.offlineEntitlementExpiresAt) > input.now.getTime();
    if (unchanged) continue;
    const revision = device.serviceConfigRevision + 1;
    const directive = { ...candidate, revision };
    const serviceEntitlementState = candidate.reasonCode === "scope_unavailable" ? "suspended" : candidate.commercialState === "trialing" ? "trial"
      : candidate.commercialState === "active" || candidate.commercialState === "grace_period" || candidate.commercialState === "cancel_pending" ? "active"
        : candidate.commercialState === "suspended" || candidate.commercialState === "past_due" ? "suspended"
          : candidate.commercialState === "cancelled" ? "cancelled"
            : candidate.commercialState === "none" ? "inactive" : "expired";
    await tx.update(nightlyDevices).set({
      serviceEntitlementState,
      serviceSuspendedAt: candidate.reasonCode !== "scope_unavailable" && candidate.managementAvailable && (candidate.commercialState === "active" || candidate.commercialState === "trialing" || candidate.commercialState === "grace_period" || candidate.commercialState === "cancel_pending") ? null : input.now,
      serviceConfigRevision: revision,
      desiredConfigRevision: randomUUID(),
      serviceStateJson: JSON.stringify({ ...oldState, commercialDirective: directive }),
      updatedAt: input.now,
    }).where(eq(nightlyDevices.id, device.id));
    await tx.insert(auditLogs).values({ actorClerkUserId: "nightly-commercial-system", actorRole: "system", entityType: "nightly_device", entityId: device.publicDeviceUuid, action: "commercial_device_directive_changed", previousValuesJson: JSON.stringify({ serviceEntitlementState: device.serviceEntitlementState }), nextValuesJson: JSON.stringify({ serviceEntitlementState, commercialState: directive.commercialState, revision }), metadataJson: JSON.stringify({ venueId: input.venueId, capabilityCount: directive.allowedCapabilities.length }) });
  }
}

export async function refreshDeviceCommercialDirective(deviceId: number, now = new Date()) {
  return db.transaction(async (tx) => {
    const [device] = await tx.select().from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).for("update").limit(1);
    if (!device) throw new CommercialEntitlementError("scope_mismatch", 404);
    if (!device.venueId) return directiveForSubscription({ subscription: null, scopeUnavailable: false, deviceId, revision: device.serviceConfigRevision, now });
    const [venue] = await tx.select({ suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, device.venueId)).limit(1);
    const [subscription] = await tx.select().from(commercialSubscriptions).where(and(eq(commercialSubscriptions.scopeType, "venue"), eq(commercialSubscriptions.scopeId, device.venueId), eq(commercialSubscriptions.product, "venue_package"))).for("share").limit(1);
    await updateDeviceDirectiveInTransaction(tx, { venueId: device.venueId, subscription: subscription ?? null, scopeUnavailable: venue?.suspendedAt != null, now });
    const [updated] = await tx.select().from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).limit(1);
    return parseJsonObject(updated?.serviceStateJson).commercialDirective ?? directiveForSubscription({ subscription: subscription ?? null, scopeUnavailable: venue?.suspendedAt != null, deviceId, revision: device.serviceConfigRevision, now });
  });
}

function productMatchesScope(scope: CommercialScope, product: CommercialProduct) {
  return (scope === "venue" && product === "venue_package") || (scope === "consumer" && product === "consumer_premium") || (scope === "artist" && product === "artist_subscription");
}

export async function transitionCommercialSubscription(input: {
  scope: CommercialScope;
  scopeId: number;
  product: CommercialProduct;
  state: CommercialSubscriptionSnapshot["state"];
  reason: string;
  actorUserId: number;
  actorClerkUserId: string;
  trialEndsAt?: Date | null;
  graceUntil?: Date | null;
  endsAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!productMatchesScope(input.scope, input.product) || !Number.isSafeInteger(input.scopeId) || input.scopeId <= 0 || input.reason.trim().length < 8 || input.reason.length > 500) throw new CommercialEntitlementError("invalid_request", 400);
  const scope = await resolveScope(db, input.scope, input.scopeId);
  if (!scope.exists) throw new CommercialEntitlementError("scope_mismatch", 404);
  if ((input.state === "grace_period" || input.state === "past_due") && (!input.graceUntil || input.graceUntil <= now)) throw new CommercialEntitlementError("invalid_request", 400);
  if (input.state === "trialing" && (!input.trialEndsAt || input.trialEndsAt <= now)) throw new CommercialEntitlementError("invalid_request", 400);
  if (input.state === "cancel_pending" && (!input.endsAt || input.endsAt <= now)) throw new CommercialEntitlementError("invalid_request", 400);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commercialSubscriptions).where(and(eq(commercialSubscriptions.scopeType, input.scope), eq(commercialSubscriptions.scopeId, input.scopeId), eq(commercialSubscriptions.product, input.product))).for("update").limit(1);
    const nextState = input.state;
    if (existing && existing.state !== nextState && !(commercialTransitions[existing.state] ?? []).includes(nextState)) throw new CommercialEntitlementError("invalid_transition", 409);
    const previous = existing ? { state: existing.state, revision: existing.revision, graceUntil: existing.graceUntil?.toISOString() ?? null, endsAt: existing.endsAt?.toISOString() ?? null } : null;
    let updated: typeof commercialSubscriptions.$inferSelect;
    if (!existing) {
      const [created] = await tx.insert(commercialSubscriptions).values({
        scopeType: input.scope, scopeId: input.scopeId, product: input.product, state: nextState, source: nextState === "trialing" ? "trial" : "manual",
        startedAt: now, trialStartedAt: nextState === "trialing" ? now : null, trialEndsAt: nextState === "trialing" ? input.trialEndsAt ?? null : null,
        graceUntil: nextState === "grace_period" || nextState === "past_due" ? input.graceUntil ?? null : null,
        cancelAt: nextState === "cancel_pending" ? input.endsAt ?? null : null,
        endsAt: input.endsAt ?? null, reasonCode: input.reason.trim(), createdByUserId: input.actorUserId, updatedByUserId: input.actorUserId,
      }).returning();
      updated = created;
    } else {
      const [row] = await tx.update(commercialSubscriptions).set({
        state: nextState, revision: existing.revision + 1, updatedByUserId: input.actorUserId, updatedAt: now, reasonCode: input.reason.trim(),
        ...(nextState === "trialing" ? { trialStartedAt: now, trialEndsAt: input.trialEndsAt ?? null } : {}),
        ...(nextState === "grace_period" || nextState === "past_due" ? { graceUntil: input.graceUntil ?? null } : {}),
        ...(nextState === "cancel_pending" ? { cancelAt: input.endsAt ?? null, endsAt: input.endsAt ?? null } : {}),
        ...(nextState === "active" ? { graceUntil: null, cancelAt: null, endsAt: input.endsAt ?? null } : {}),
        ...(nextState === "cancelled" || nextState === "expired" ? { endsAt: input.endsAt ?? now } : {}),
      }).where(eq(commercialSubscriptions.id, existing.id)).returning();
      updated = row;
    }
    await tx.insert(auditLogs).values({ actorClerkUserId: input.actorClerkUserId, actorRole: "admin", entityType: "commercial_subscription", entityId: `${input.scope}:${input.scopeId}:${input.product}`, action: "commercial_state_changed", previousValuesJson: previous ? JSON.stringify(previous) : null, nextValuesJson: JSON.stringify({ state: updated.state, revision: updated.revision, graceUntil: updated.graceUntil?.toISOString() ?? null, endsAt: updated.endsAt?.toISOString() ?? null }), metadataJson: JSON.stringify({ reason: input.reason.trim(), source: updated.source }) });
    if (input.scope === "venue") await updateDeviceDirectiveInTransaction(tx, { venueId: input.scopeId, subscription: updated, scopeUnavailable: scope.suspended, now, forceRevision: true });
    return updated;
  });
}

export async function getDeviceCommercialDirective(deviceId: number, now = new Date()) {
  const [device] = await db.select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, serviceConfigRevision: nightlyDevices.serviceConfigRevision }).from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).limit(1);
  if (!device) throw new CommercialEntitlementError("scope_mismatch", 404);
  if (!device.venueId) return directiveForSubscription({ subscription: null, scopeUnavailable: false, deviceId, revision: device.serviceConfigRevision, now });
  const [venue] = await db.select({ suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, device.venueId)).limit(1);
  const [subscription] = await db.select().from(commercialSubscriptions).where(and(
    eq(commercialSubscriptions.scopeType, "venue"),
    eq(commercialSubscriptions.scopeId, device.venueId),
    eq(commercialSubscriptions.product, "venue_package"),
  )).limit(1);
  const grants = await db.select({ capability: commercialEntitlementGrants.capability, expiresAt: commercialEntitlementGrants.expiresAt }).from(commercialEntitlementGrants).where(and(or(
    and(eq(commercialEntitlementGrants.scopeType, "venue"), eq(commercialEntitlementGrants.scopeId, device.venueId)),
    and(eq(commercialEntitlementGrants.scopeType, "device"), eq(commercialEntitlementGrants.scopeId, deviceId)),
  ), lte(commercialEntitlementGrants.startsAt, now), or(isNull(commercialEntitlementGrants.expiresAt), gt(commercialEntitlementGrants.expiresAt, now)), isNull(commercialEntitlementGrants.revokedAt)));
  return directiveForSubscription({ subscription: subscription ?? null, scopeUnavailable: venue?.suspendedAt != null, deviceId, revision: device.serviceConfigRevision, now, manualCapabilities: grants.map((grant) => grant.capability), manualGrantExpiresAt: grants.map((grant) => grant.expiresAt).filter((value): value is Date => value !== null).sort((left,right)=>left.getTime()-right.getTime())[0] ?? null });
}

export async function issueCommercialGrant(input: { scope: CommercialScope; scopeId: number; capability: CommercialCapability; reason: string; issuedByUserId: number; actorClerkUserId: string; expiresAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  if (!Number.isSafeInteger(input.scopeId) || input.scopeId <= 0 || input.reason.trim().length < 8 || input.reason.length > 500 || input.expiresAt <= now || input.expiresAt.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000) throw new CommercialEntitlementError("invalid_request", 400);
  if (input.scope === "organization" || (input.scope === "venue" && !(input.capability.startsWith("venue.") || input.capability.startsWith("device."))) || (input.scope === "device" && !input.capability.startsWith("device.")) || (input.scope === "consumer" && !input.capability.startsWith("consumer.")) || (input.scope === "artist" && !input.capability.startsWith("artist."))) throw new CommercialEntitlementError("scope_mismatch", 400);
  const scope = await resolveScope(db, input.scope, input.scopeId);
  if (!scope.exists) throw new CommercialEntitlementError("scope_mismatch", 404);
  const publicId = randomUUID();
  return db.transaction(async (tx) => {
    const [grant] = await tx.insert(commercialEntitlementGrants).values({ publicId, scopeType: input.scope, scopeId: input.scopeId, capability: input.capability, source: "manual", reason: input.reason.trim(), startsAt: now, expiresAt: input.expiresAt, issuedByUserId: input.issuedByUserId }).returning();
    await tx.insert(auditLogs).values({ actorClerkUserId: input.actorClerkUserId, actorRole: "admin", entityType: "commercial_entitlement_grant", entityId: publicId, action: "commercial_manual_grant_issued", nextValuesJson: JSON.stringify({ scope: input.scope, scopeId: input.scopeId, capability: input.capability, expiresAt: input.expiresAt.toISOString() }), metadataJson: JSON.stringify({ reason: input.reason.trim() }) });
    const venueId = input.scope === "venue" ? input.scopeId : input.scope === "device"
      ? (await tx.select({ venueId: nightlyDevices.venueId }).from(nightlyDevices).where(eq(nightlyDevices.id, input.scopeId)).limit(1))[0]?.venueId
      : null;
    if (venueId) {
      const [subscription] = await tx.select().from(commercialSubscriptions).where(and(eq(commercialSubscriptions.scopeType, "venue"), eq(commercialSubscriptions.scopeId, venueId), eq(commercialSubscriptions.product, "venue_package"))).limit(1);
      const [venue] = await tx.select({ suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, venueId)).limit(1);
      await updateDeviceDirectiveInTransaction(tx, { venueId, subscription: subscription ?? null, scopeUnavailable: venue?.suspendedAt != null, now, forceRevision: true });
    }
    return grant;
  });
}

export async function revokeCommercialGrant(input: { publicId: string; revokedByUserId: number; actorClerkUserId: string; reason: string; now?: Date }) {
  const now = input.now ?? new Date();
  if (!/^[0-9a-f-]{36}$/i.test(input.publicId) || input.reason.trim().length < 8 || input.reason.length > 500) throw new CommercialEntitlementError("invalid_request", 400);
  return db.transaction(async (tx) => {
    const [grant] = await tx.select().from(commercialEntitlementGrants).where(eq(commercialEntitlementGrants.publicId, input.publicId)).for("update").limit(1);
    if (!grant) throw new CommercialEntitlementError("not_found", 404);
    if (grant.revokedAt) return grant;
    const [updated] = await tx.update(commercialEntitlementGrants).set({ revokedAt: now, updatedAt: now }).where(and(eq(commercialEntitlementGrants.id, grant.id), isNull(commercialEntitlementGrants.revokedAt))).returning();
    await tx.insert(auditLogs).values({ actorClerkUserId: input.actorClerkUserId, actorRole: "admin", entityType: "commercial_entitlement_grant", entityId: grant.publicId, action: "commercial_manual_grant_revoked", previousValuesJson: JSON.stringify({ revokedAt: null }), nextValuesJson: JSON.stringify({ revokedAt: now.toISOString() }), metadataJson: JSON.stringify({ reason: input.reason.trim() }) });
    const venueId = grant.scopeType === "venue" ? grant.scopeId : grant.scopeType === "device"
      ? (await tx.select({ venueId: nightlyDevices.venueId }).from(nightlyDevices).where(eq(nightlyDevices.id, grant.scopeId)).limit(1))[0]?.venueId
      : null;
    if (venueId) {
      const [subscription] = await tx.select().from(commercialSubscriptions).where(and(eq(commercialSubscriptions.scopeType, "venue"), eq(commercialSubscriptions.scopeId, venueId), eq(commercialSubscriptions.product, "venue_package"))).limit(1);
      const [venue] = await tx.select({ suspendedAt: venues.suspendedAt }).from(venues).where(eq(venues.id, venueId)).limit(1);
      await updateDeviceDirectiveInTransaction(tx, { venueId, subscription: subscription ?? null, scopeUnavailable: venue?.suspendedAt != null, now, forceRevision: true });
    }
    return updated;
  });
}

export async function issueCommercialServiceAuthorization(input: { publicId: string; actorUserId: number; issuerUserId: number; issuerClerkUserId: string; scope: CommercialScope; scopeId: number; purpose: typeof commercialServiceAuthorizations.$inferInsert.purpose; capabilities: string[]; reason: string; expiresAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  if (!/^[0-9a-f-]{36}$/i.test(input.publicId) || !Number.isSafeInteger(input.scopeId) || input.scopeId <= 0 || input.capabilities.length === 0 || input.capabilities.length > 8 || input.capabilities.some((capability) => !COMMERCIAL_CAPABILITIES.includes(capability as CommercialCapability) || !SERVICE_CAPABILITIES_BY_PURPOSE[input.purpose].includes(capability as CommercialCapability)) || input.reason.trim().length < 8 || input.reason.length > 500 || input.expiresAt <= now || input.expiresAt.getTime() > now.getTime() + 24 * 60 * 60 * 1000) throw new CommercialEntitlementError("invalid_request", 400);
  if (input.scope !== "venue" && input.scope !== "device") throw new CommercialEntitlementError("scope_mismatch", 400);
  const scope = await resolveScope(db, input.scope, input.scopeId);
  if (!scope.exists) throw new CommercialEntitlementError("scope_mismatch", 404);
  return db.transaction(async (tx) => {
    const [actor] = await tx.select({ id: users.id, accountStatus: users.accountStatus }).from(users).where(eq(users.id, input.actorUserId)).for("share").limit(1);
    if (!actor || actor.accountStatus !== "active") throw new CommercialEntitlementError("forbidden", 403);
    const [authorization] = await tx.insert(commercialServiceAuthorizations).values({ publicId: input.publicId, actorUserId: input.actorUserId, issuerUserId: input.issuerUserId, scopeType: input.scope, scopeId: input.scopeId, purpose: input.purpose, capabilities: [...new Set(input.capabilities)], reason: input.reason.trim(), issuedAt: now, expiresAt: input.expiresAt }).returning();
    await tx.insert(auditLogs).values({ actorClerkUserId: input.issuerClerkUserId, actorRole: "admin", entityType: "commercial_service_authorization", entityId: authorization.publicId, action: "service_authorization_issued", nextValuesJson: JSON.stringify({ actorUserId: input.actorUserId, scope: input.scope, scopeId: input.scopeId, purpose: input.purpose, capabilities: authorization.capabilities, expiresAt: input.expiresAt.toISOString() }), metadataJson: JSON.stringify({ reason: input.reason.trim() }) });
    return authorization;
  });
}

export async function revokeCommercialServiceAuthorization(input: { publicId: string; revokedByUserId: number; actorClerkUserId: string; reason: string; now?: Date }) {
  const now = input.now ?? new Date();
  if (!/^[0-9a-f-]{36}$/i.test(input.publicId) || input.reason.trim().length < 8 || input.reason.length > 500) throw new CommercialEntitlementError("invalid_request", 400);
  return db.transaction(async (tx) => {
    const [authorization] = await tx.select().from(commercialServiceAuthorizations).where(eq(commercialServiceAuthorizations.publicId, input.publicId)).for("update").limit(1);
    if (!authorization) throw new CommercialEntitlementError("not_found", 404);
    if (authorization.revokedAt) return authorization;
    const [updated] = await tx.update(commercialServiceAuthorizations).set({ revokedAt: now, revokedByUserId: input.revokedByUserId, updatedAt: now }).where(and(eq(commercialServiceAuthorizations.id, authorization.id), isNull(commercialServiceAuthorizations.revokedAt))).returning();
    await tx.insert(auditLogs).values({ actorClerkUserId: input.actorClerkUserId, actorRole: "admin", entityType: "commercial_service_authorization", entityId: authorization.publicId, action: "service_authorization_revoked", previousValuesJson: JSON.stringify({ revokedAt: null }), nextValuesJson: JSON.stringify({ revokedAt: now.toISOString() }), metadataJson: JSON.stringify({ reason: input.reason.trim() }) });
    return updated;
  });
}