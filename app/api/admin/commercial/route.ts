import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeRateLimit } from "@/lib/platform/rate-limit";
import { COMMERCIAL_CAPABILITIES, COMMERCIAL_PRODUCTS, COMMERCIAL_SCOPES, COMMERCIAL_SERVICE_PURPOSES } from "@/lib/commercial-entitlements/policy";
import { commercialErrorResponse, commercialMutationSameOrigin, readCommercialJson } from "@/lib/commercial-entitlements/http";
import { CommercialEntitlementError, getCommercialSubscriptionStatus, issueCommercialGrant, issueCommercialServiceAuthorization, listCommercialSubscriptions, revokeCommercialGrant, revokeCommercialServiceAuthorization, transitionCommercialSubscription } from "@/lib/commercial-entitlements/service";

const states = new Set(["trialing","active","grace_period","past_due","suspended","cancel_pending","cancelled","expired"]);
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

async function requireCommercialAdmin(permission: "subscriptions:view" | "subscriptions:manage") {
  try { return await requireAdminPermission(permission); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized.")) throw new CommercialEntitlementError("unauthorized", 401);
    if (message.startsWith("Forbidden.")) throw new CommercialEntitlementError("forbidden", 403);
    throw error;
  }
}

async function actorIdentity() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new CommercialEntitlementError("unauthorized", 401);
  const [user] = await db.select({ id: users.id, clerkUserId: users.clerkUserId }).from(users).where(and(eq(users.clerkUserId, clerkUserId), eq(users.accountStatus, "active"))).limit(1);
  if (!user) throw new CommercialEntitlementError("forbidden", 403);
  return user;
}

export async function GET(request: Request) {
  try {
    await requireCommercialAdmin("subscriptions:view");
    const params = new URL(request.url).searchParams;
    const scope = params.get("scope");
    const scopeId = params.get("scopeId");
    if (scope === null && scopeId === null) return NextResponse.json({ subscriptions: await listCommercialSubscriptions(100) }, { headers: { "Cache-Control": "no-store" } });
    if (!COMMERCIAL_SCOPES.includes(scope as typeof COMMERCIAL_SCOPES[number]) || !/^\d{1,10}$/.test(scopeId ?? "")) throw new CommercialEntitlementError("invalid_request", 400);
    return NextResponse.json(await getCommercialSubscriptionStatus(scope as typeof COMMERCIAL_SCOPES[number], Number(scopeId)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return commercialErrorResponse(error); }
}

export async function POST(request: Request) {
  if (!commercialMutationSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readCommercialJson(request);
  if (!body || typeof body.operation !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const admin = await requireCommercialAdmin("subscriptions:manage");
    const rate = consumeRateLimit({ key: admin.clerkUserId, scope: "user", burstLimit: 10, sustainedLimit: 30, windowMs: 60_000, route: "admin-commercial-mutations" });
    if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rate.retryAfterSeconds) } });
    const actor = await actorIdentity();
    if (body.operation === "transition") {
      if (!COMMERCIAL_SCOPES.includes(body.scope as typeof COMMERCIAL_SCOPES[number]) || !COMMERCIAL_PRODUCTS.includes(body.product as typeof COMMERCIAL_PRODUCTS[number]) || !positiveId(body.scopeId) || typeof body.state !== "string" || !states.has(body.state) || typeof body.reason !== "string") throw new CommercialEntitlementError("invalid_request", 400);
      const date = (value: unknown) => typeof value === "string" ? new Date(value) : null;
      const inputDate = (value: unknown) => { const parsed = date(value); if (parsed && !Number.isFinite(parsed.getTime())) throw new CommercialEntitlementError("invalid_request", 400); return parsed; };
      const subscription = await transitionCommercialSubscription({ scope: body.scope as typeof COMMERCIAL_SCOPES[number], scopeId: body.scopeId, product: body.product as typeof COMMERCIAL_PRODUCTS[number], state: body.state as never, reason: body.reason, actorUserId: actor.id, actorClerkUserId: actor.clerkUserId, trialEndsAt: inputDate(body.trialEndsAt), graceUntil: inputDate(body.graceUntil), endsAt: inputDate(body.endsAt) });
      return NextResponse.json({ id: subscription.id, scope: subscription.scopeType, scopeId: subscription.scopeId, product: subscription.product, state: subscription.state, revision: subscription.revision }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
    if (body.operation === "grant") {
      if (!COMMERCIAL_SCOPES.includes(body.scope as typeof COMMERCIAL_SCOPES[number]) || !positiveId(body.scopeId) || !COMMERCIAL_CAPABILITIES.includes(body.capability as typeof COMMERCIAL_CAPABILITIES[number]) || typeof body.reason !== "string" || typeof body.expiresAt !== "string") throw new CommercialEntitlementError("invalid_request", 400);
      const expiresAt = new Date(body.expiresAt);
      if (!Number.isFinite(expiresAt.getTime())) throw new CommercialEntitlementError("invalid_request", 400);
      const grant = await issueCommercialGrant({ scope: body.scope as typeof COMMERCIAL_SCOPES[number], scopeId: body.scopeId, capability: body.capability as typeof COMMERCIAL_CAPABILITIES[number], reason: body.reason, issuedByUserId: actor.id, actorClerkUserId: actor.clerkUserId, expiresAt });
      return NextResponse.json({ publicId: grant.publicId, scope: grant.scopeType, scopeId: grant.scopeId, capability: grant.capability, expiresAt: grant.expiresAt?.toISOString() ?? null }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (body.operation === "revoke_grant") {
      if (typeof body.publicId !== "string" || typeof body.reason !== "string") throw new CommercialEntitlementError("invalid_request", 400);
      const grant = await revokeCommercialGrant({ publicId: body.publicId, revokedByUserId: actor.id, actorClerkUserId: actor.clerkUserId, reason: body.reason });
      return NextResponse.json({ publicId: grant.publicId, revoked: grant.revokedAt !== null }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.operation === "issue_service_authorization") {
      if (typeof body.targetUserId !== "number" || !positiveId(body.targetUserId) || !COMMERCIAL_SCOPES.includes(body.scope as typeof COMMERCIAL_SCOPES[number]) || !positiveId(body.scopeId) || !COMMERCIAL_SERVICE_PURPOSES.includes(body.purpose as typeof COMMERCIAL_SERVICE_PURPOSES[number]) || !Array.isArray(body.capabilities) || body.capabilities.length > 8 || body.capabilities.some((capability) => typeof capability !== "string" || !/^service\.[a-z0-9_.]+$/.test(capability)) || typeof body.reason !== "string" || typeof body.expiresAt !== "string") throw new CommercialEntitlementError("invalid_request", 400);
      const expiresAt = new Date(body.expiresAt);
      if (!Number.isFinite(expiresAt.getTime())) throw new CommercialEntitlementError("invalid_request", 400);
      const authorization = await issueCommercialServiceAuthorization({ publicId: randomUUID(), actorUserId: body.targetUserId, issuerUserId: actor.id, issuerClerkUserId: actor.clerkUserId, scope: body.scope as typeof COMMERCIAL_SCOPES[number], scopeId: body.scopeId, purpose: body.purpose as never, capabilities: body.capabilities as string[], reason: body.reason, expiresAt });
      return NextResponse.json({ publicId: authorization.publicId, actorUserId: authorization.actorUserId, scope: authorization.scopeType, scopeId: authorization.scopeId, purpose: authorization.purpose, capabilities: authorization.capabilities, issuedAt: authorization.issuedAt.toISOString(), expiresAt: authorization.expiresAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (body.operation === "revoke_service_authorization") {
      if (typeof body.publicId !== "string" || typeof body.reason !== "string") throw new CommercialEntitlementError("invalid_request", 400);
      const authorization = await revokeCommercialServiceAuthorization({ publicId: body.publicId, revokedByUserId: actor.id, actorClerkUserId: actor.clerkUserId, reason: body.reason });
      return NextResponse.json({ publicId: authorization.publicId, revoked: authorization.revokedAt !== null }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new CommercialEntitlementError("invalid_request", 400);
  } catch (error) { return commercialErrorResponse(error); }
}