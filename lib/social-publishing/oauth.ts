import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, socialOAuthStates, socialPlatformAccounts, socialPublications } from "@/db/schema";
import type { AuthorizedSocialActor } from "./auth";
import { getSocialCredentialStore } from "./credentials";
import { SocialPublishingError } from "./errors";
import { getSocialPublishingProvider } from "./provider";
import type { SocialPlatform } from "./types";
import { createOAuthPkcePair, hashOAuthState, SOCIAL_OAUTH_STATE_TTL_MS, socialOAuthStateFailure, validateOAuthAuthorizationUrl, validateRequestedSocialScopes, validateSocialOAuthRedirect } from "./oauth-security";
import { socialPublishingCapabilities } from "./types";
import { socialAccountReconnectDecision } from "./policy";
import { logger } from "@/lib/platform/logger";

export type SocialOAuthProvider = {
  readonly platform: SocialPlatform;
  readonly providerKey: string;
  readonly authorizationOrigin: string;
  readonly allowedScopes: ReadonlySet<string>;
  readonly publicationCapabilities: ReadonlySet<string>;
  readonly pkceRequired: boolean;
  buildAuthorizationUrl(input: { state: string; redirectUri: string; scopes: string[]; codeChallenge?: string }): URL;
  exchangeAuthorizationCode(input: { code: string; redirectUri: string; codeVerifier?: string }): Promise<{
    providerAccountId: string;
    displayName: string;
    accountType: "business" | "creator" | "page" | "channel" | "personal" | "unknown";
    credentialBundle: string;
    grantedScopes: string[];
    expiresAt: Date | null;
    safeMetadata: Record<string, string | number | boolean | null>;
  }>;
};

const providers = new Map<SocialPlatform, SocialOAuthProvider>();

export function registerSocialOAuthProvider(provider: SocialOAuthProvider) {
  providers.set(provider.platform, provider);
}

export function getSocialOAuthProvider(platform: SocialPlatform) {
  return providers.get(platform) ?? null;
}

export async function beginSocialOAuth(input: {
  actor: AuthorizedSocialActor;
  platform: SocialPlatform;
  scopes: string[];
  redirectUri: string;
  now?: number;
}) {
  const provider = getSocialOAuthProvider(input.platform);
  if (!provider) throw new SocialPublishingError("provider_not_configured", 503);
  const redirectUri = validateSocialOAuthRedirect(input.redirectUri);
  const scopes = validateRequestedSocialScopes(input.scopes, provider.allowedScopes);
  const state = randomBytes(32).toString("base64url");
  const { verifier, challenge } = createOAuthPkcePair();
  const store = getSocialCredentialStore();
  const verifierRecord = await store.put({ venueId: input.actor.venueId, platform: input.platform, secret: verifier });
  const now = input.now ?? Date.now();
  const expiresAt = new Date(now + SOCIAL_OAUTH_STATE_TTL_MS);

  try {
    await db.insert(socialOAuthStates).values({
      stateHash: hashOAuthState(state),
      platform: input.platform,
      venueId: input.actor.venueId,
      actorClerkUserId: input.actor.clerkUserId,
      redirectUri,
      requestedScopesJson: JSON.stringify(scopes),
      pkceVerifierRef: verifierRecord.reference,
      expiresAt,
      createdAt: new Date(now),
    });
  } catch {
    await store.delete(verifierRecord.reference).catch(() => undefined);
    throw new SocialPublishingError("internal_failure", 500);
  }

  let authorizationUrl: URL;
  try {
    authorizationUrl = provider.buildAuthorizationUrl({
      state,
      redirectUri,
      scopes,
      codeChallenge: provider.pkceRequired ? challenge : undefined,
    });
  } catch {
    await db.delete(socialOAuthStates).where(eq(socialOAuthStates.stateHash, hashOAuthState(state)));
    await store.delete(verifierRecord.reference).catch(() => undefined);
    throw new SocialPublishingError("provider_not_configured", 503);
  }
  try {
    validateOAuthAuthorizationUrl(authorizationUrl, provider.authorizationOrigin);
  } catch (error) {
    await db.delete(socialOAuthStates).where(eq(socialOAuthStates.stateHash, hashOAuthState(state)));
    await store.delete(verifierRecord.reference).catch(() => undefined);
    throw error;
  }
  return { authorizationUrl: authorizationUrl.toString(), expiresAt: expiresAt.toISOString() };
}

export async function consumeSocialOAuthState(input: {
  state: string;
  actor: AuthorizedSocialActor;
  redirectUri: string;
  now?: number;
}) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(input.state)) throw new SocialPublishingError("oauth_state_invalid", 400);
  const redirectUri = validateSocialOAuthRedirect(input.redirectUri);
  const stateHash = hashOAuthState(input.state);
  const now = new Date(input.now ?? Date.now());
  const [consumed] = await db.update(socialOAuthStates)
    .set({ consumedAt: now })
    .where(and(
      eq(socialOAuthStates.stateHash, stateHash),
      eq(socialOAuthStates.venueId, input.actor.venueId),
      eq(socialOAuthStates.actorClerkUserId, input.actor.clerkUserId),
      eq(socialOAuthStates.redirectUri, redirectUri),
      isNull(socialOAuthStates.consumedAt),
      gt(socialOAuthStates.expiresAt, now),
    ))
    .returning();

  if (!consumed) {
    const [existing] = await db.select({ expiresAt: socialOAuthStates.expiresAt, consumedAt: socialOAuthStates.consumedAt, pkceVerifierRef: socialOAuthStates.pkceVerifierRef })
      .from(socialOAuthStates).where(eq(socialOAuthStates.stateHash, stateHash)).limit(1);
    const code = socialOAuthStateFailure({ exists: Boolean(existing), consumedAt: existing?.consumedAt ?? null, expiresAt: existing?.expiresAt ?? null, now });
    if (code === "oauth_state_expired" && existing?.pkceVerifierRef) {
      try {
        await getSocialCredentialStore().delete(existing.pkceVerifierRef);
        await db.delete(socialOAuthStates).where(and(
          eq(socialOAuthStates.stateHash, stateHash),
          isNull(socialOAuthStates.consumedAt),
          lte(socialOAuthStates.expiresAt, now),
        ));
      } catch {
        logger.warn("social_oauth_expired_verifier_cleanup_failed", { failureCode: "internal_failure" });
      }
    }
    throw new SocialPublishingError(code, code === "oauth_state_replayed" ? 409 : 400);
  }

  return {
    stateHash: consumed.stateHash,
    platform: consumed.platform,
    venueId: consumed.venueId,
    actorClerkUserId: consumed.actorClerkUserId,
    redirectUri: consumed.redirectUri,
    requestedScopes: JSON.parse(consumed.requestedScopesJson) as string[],
    pkceVerifierRef: consumed.pkceVerifierRef,
  };
}

function safeMetadataJson(value: Record<string, string | number | boolean | null>) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || /(token|secret|password|cookie|url|uri|code)/i.test(key)) continue;
    if (typeof item === "string" && (item.length > 120 || /https?:\/\//i.test(item))) continue;
    if (typeof item === "number" && !Number.isFinite(item)) continue;
    safe[key] = item;
  }
  return JSON.stringify(safe);
}

export async function completeSocialOAuth(input: {
  actor: AuthorizedSocialActor;
  state: string;
  code: string;
  redirectUri: string;
  now?: number;
}) {
  if (!/^[A-Za-z0-9._~-]{1,2048}$/.test(input.code)) throw new SocialPublishingError("oauth_state_invalid", 400);
  const state = await consumeSocialOAuthState({ state: input.state, actor: input.actor, redirectUri: input.redirectUri, now: input.now });
  const store = getSocialCredentialStore();
  let oauthProvider: SocialOAuthProvider;
  let account: Awaited<ReturnType<SocialOAuthProvider["exchangeAuthorizationCode"]>>;
  try {
    const provider = getSocialOAuthProvider(state.platform);
    if (!provider) throw new SocialPublishingError("provider_not_configured", 503);
    oauthProvider = provider;
    const verifierRecord = state.pkceVerifierRef ? await store.get(state.pkceVerifierRef) : null;
    if (oauthProvider.pkceRequired && !verifierRecord) throw new SocialPublishingError("oauth_state_invalid", 400);
    const verifier = verifierRecord?.secret;
    account = await oauthProvider.exchangeAuthorizationCode({ code: input.code, redirectUri: state.redirectUri, codeVerifier: verifier });
  } finally {
    if (state.pkceVerifierRef) await store.delete(state.pkceVerifierRef).catch(() => undefined);
  }
  if (!/^[A-Za-z0-9._:-]{1,300}$/.test(account.providerAccountId) || !account.displayName.trim() || account.displayName.length > 120 || !account.credentialBundle || account.credentialBundle.length > 16_384) {
    throw new SocialPublishingError("invalid_request", 502);
  }
  if (account.expiresAt && (!Number.isFinite(account.expiresAt.getTime()) || account.expiresAt.getTime() <= (input.now ?? Date.now()))) {
    throw new SocialPublishingError("authorization_expired", 409);
  }
  const grantedScopes = validateRequestedSocialScopes(account.grantedScopes, oauthProvider.allowedScopes);
  if (state.requestedScopes.some((scope) => !grantedScopes.includes(scope)) || grantedScopes.some((scope) => !state.requestedScopes.includes(scope))) throw new SocialPublishingError("scope_not_allowed", 403);
  const publishProvider = getSocialPublishingProvider();
  const availableCapabilities = publishProvider.getCapabilities(state.platform);
  const allowedCapabilities = new Set<string>(socialPublishingCapabilities);
  const declaredCapabilities = [...oauthProvider.publicationCapabilities].filter((capability) => allowedCapabilities.has(capability) && availableCapabilities.has(capability as never));
  const credential = await store.put({ venueId: state.venueId, platform: state.platform, secret: account.credentialBundle });
  const now = new Date(input.now ?? Date.now());

  let connected: { publicId: string; previousCredentialRef: string | null; reconnected: boolean };
  try {
    connected = await db.transaction(async (tx) => {
      let [existing] = await tx.select().from(socialPlatformAccounts).where(and(
        eq(socialPlatformAccounts.platform, state.platform),
        eq(socialPlatformAccounts.providerAccountId, account.providerAccountId),
      )).for("update").limit(1);

      if (!existing) {
        const [created] = await tx.insert(socialPlatformAccounts).values({
          publicId: randomBytes(16).toString("hex"),
          venueId: state.venueId,
          platform: state.platform,
          providerAccountId: account.providerAccountId,
          displayName: account.displayName.trim(),
          accountType: account.accountType,
          connectionState: "connected",
          authorizationState: "valid",
          grantedScopesJson: JSON.stringify(grantedScopes),
          capabilitiesJson: JSON.stringify(declaredCapabilities),
          authorizedAt: now,
          expiresAt: account.expiresAt,
          reconnectRequired: false,
          credentialRef: credential.reference,
          safeMetadataJson: safeMetadataJson(account.safeMetadata),
          lastVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoNothing().returning({ publicId: socialPlatformAccounts.publicId });
        if (created) {
          await tx.insert(auditLogs).values({ actorClerkUserId: input.actor.clerkUserId, actorRole: input.actor.role, entityType: "social_platform_account", entityId: created.publicId, action: "social_account_connected", nextValuesJson: JSON.stringify({ platform: state.platform, displayName: account.displayName.trim(), grantedScopes, capabilities: declaredCapabilities }), metadataJson: JSON.stringify({ venueId: state.venueId, provider: oauthProvider.providerKey }) });
          return { publicId: created.publicId, previousCredentialRef: null, reconnected: false };
        }
        [existing] = await tx.select().from(socialPlatformAccounts).where(and(
          eq(socialPlatformAccounts.platform, state.platform),
          eq(socialPlatformAccounts.providerAccountId, account.providerAccountId),
        )).for("update").limit(1);
      }

      if (!existing) throw new SocialPublishingError("internal_failure", 500);
      const [activeDestination] = await tx.select({ id: socialPublications.id }).from(socialPublications).where(and(
        eq(socialPublications.accountId, existing.id),
        inArray(socialPublications.state, ["authorized", "uploading", "processing", "revoke_requested"]),
      )).limit(1);
      const decision = socialAccountReconnectDecision({ existingVenueId: existing.venueId, requestedVenueId: state.venueId, hasActiveRemoteWork: activeDestination !== undefined });
      if (decision === "venue_conflict") throw new SocialPublishingError("account_not_connected", 409);
      if (decision === "publishing_in_progress") throw new SocialPublishingError("publishing_in_progress", 409);

      const [reconnected] = await tx.update(socialPlatformAccounts).set({
        displayName: account.displayName.trim(),
        accountType: account.accountType,
        connectionState: "connected",
        authorizationState: "valid",
        grantedScopesJson: JSON.stringify(grantedScopes),
        capabilitiesJson: JSON.stringify(declaredCapabilities),
        authorizedAt: now,
        expiresAt: account.expiresAt,
        reconnectRequired: false,
        credentialRef: credential.reference,
        safeMetadataJson: safeMetadataJson(account.safeMetadata),
        lastVerifiedAt: now,
        disconnectedAt: null,
        revokedAt: null,
        updatedAt: now,
      }).where(and(eq(socialPlatformAccounts.id, existing.id), eq(socialPlatformAccounts.venueId, state.venueId))).returning({ publicId: socialPlatformAccounts.publicId });
      if (!reconnected) throw new SocialPublishingError("account_not_connected", 409);
      await tx.insert(auditLogs).values({ actorClerkUserId: input.actor.clerkUserId, actorRole: input.actor.role, entityType: "social_platform_account", entityId: reconnected.publicId, action: "social_account_reconnected", previousValuesJson: JSON.stringify({ connectionState: existing.connectionState, authorizationState: existing.authorizationState }), nextValuesJson: JSON.stringify({ platform: state.platform, displayName: account.displayName.trim(), grantedScopes, capabilities: declaredCapabilities }), metadataJson: JSON.stringify({ venueId: state.venueId, provider: oauthProvider.providerKey }) });
      return { publicId: reconnected.publicId, previousCredentialRef: existing.credentialRef, reconnected: true };
    });
  } catch (error) {
    await store.delete(credential.reference).catch(() => undefined);
    throw error;
  }
  if (connected.previousCredentialRef && connected.previousCredentialRef !== credential.reference) {
    await store.delete(connected.previousCredentialRef).catch(() => {
      logger.warn("social_old_credential_cleanup_failed", { venueId: state.venueId, platform: state.platform, accountId: connected.publicId });
    });
  }
  return { accountId: connected.publicId, platform: state.platform, displayName: account.displayName.trim(), connectionState: "connected" };
}

export async function rejectSocialOAuth(input: {
  actor: AuthorizedSocialActor;
  state: string;
  redirectUri: string;
}) {
  const state = await consumeSocialOAuthState({ actor: input.actor, state: input.state, redirectUri: input.redirectUri });
  if (state.pkceVerifierRef) {
    await getSocialCredentialStore().delete(state.pkceVerifierRef);
  }
}
