import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auditLogs, fleetDeviceOperations, fleetSupportGrants } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForManagement, createAuthError } from "@/lib/nightly-device/auth";
import { readBoundedJson } from "@/lib/nightly-device/telemetry";
import { classifyHealthCheckResult } from "@/lib/nightly-device/operation-result";

export async function GET(request: Request) {
  const device = await authenticateDeviceRequest(request);
  if (!device) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });
  if (!await canUseDeviceForManagement(device.id)) return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  const now = new Date();
  const operations = await db.select({ id: fleetDeviceOperations.id, type: fleetDeviceOperations.type, expiresAt: fleetDeviceOperations.expiresAt })
    .from(fleetDeviceOperations).innerJoin(fleetSupportGrants, eq(fleetDeviceOperations.grantId, fleetSupportGrants.id))
    .where(and(eq(fleetDeviceOperations.deviceId, device.id), eq(fleetSupportGrants.deviceId, device.id),
      eq(fleetDeviceOperations.type, "REQUEST_HEALTH_CHECK"), eq(fleetDeviceOperations.state, "pending"),
      gt(fleetDeviceOperations.expiresAt, now), gt(fleetSupportGrants.expiresAt, now), isNull(fleetSupportGrants.revokedAt)))
    .limit(10);
  return NextResponse.json({ ok: true, operations }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const device = await authenticateDeviceRequest(request);
  if (!device) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });
  if (!await canUseDeviceForManagement(device.id)) return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  let body: { id?: unknown; resultCode?: unknown };
  try { body = await readBoundedJson(request, 512) as typeof body; } catch { return NextResponse.json(createAuthError("invalid_request", "A bounded operation result is required."), { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["id", "resultCode"].includes(key)) ||
    !Number.isSafeInteger(body.id) || (body.id as number) < 1 || !["health_ok", "health_degraded"].includes(String(body.resultCode))) {
    return NextResponse.json(createAuthError("invalid_request", "Operation result is invalid."), { status: 400 });
  }
  const id = body.id as number;
  const resultCode = body.resultCode as "health_ok" | "health_degraded";
  const outcome = await db.transaction(async (tx) => {
    const [grant] = await tx.select({ id: fleetSupportGrants.id, expiresAt: fleetSupportGrants.expiresAt, revokedAt: fleetSupportGrants.revokedAt })
      .from(fleetSupportGrants).innerJoin(fleetDeviceOperations, eq(fleetSupportGrants.id, fleetDeviceOperations.grantId))
      .where(and(eq(fleetDeviceOperations.id, id), eq(fleetDeviceOperations.deviceId, device.id), eq(fleetSupportGrants.deviceId, device.id)))
      .for("update", { of: fleetSupportGrants }).limit(1);
    if (!grant) return "unavailable";
    const [operation] = await tx.select({ id: fleetDeviceOperations.id, state: fleetDeviceOperations.state, resultCode: fleetDeviceOperations.resultCode, expiresAt: fleetDeviceOperations.expiresAt })
      .from(fleetDeviceOperations).where(and(eq(fleetDeviceOperations.id, id), eq(fleetDeviceOperations.deviceId, device.id), eq(fleetDeviceOperations.type, "REQUEST_HEALTH_CHECK")))
      .for("update").limit(1);
    if (!operation) return "unavailable";
    const now = new Date();
    const decision = classifyHealthCheckResult({ ...operation, grantExpiresAt: grant.expiresAt, grantRevokedAt: grant.revokedAt }, resultCode, now);
    if (decision !== "complete") return decision;
    await tx.update(fleetDeviceOperations).set({ state: "succeeded", resultCode, acknowledgedAt: now, completedAt: now })
      .where(and(eq(fleetDeviceOperations.id, id), eq(fleetDeviceOperations.deviceId, device.id), inArray(fleetDeviceOperations.state, ["pending"])));
    await tx.insert(auditLogs).values({ actorClerkUserId: `device:${device.publicDeviceUuid}`, actorRole: "device", entityType: "nightly_device", entityId: String(device.id), action: "fleet_health_check_completed", metadataJson: JSON.stringify({ operationId: id, resultCode }) });
    return "completed";
  });
  if (outcome === "unavailable") return NextResponse.json(createAuthError("not_found", "Operation is not available."), { status: 404 });
  if (outcome === "expired") return NextResponse.json(createAuthError("expired", "Operation is no longer authorized."), { status: 410 });
  if (outcome === "conflict") return NextResponse.json(createAuthError("stale_result", "Operation is already completed."), { status: 409 });
  return NextResponse.json({ ok: true, id, resultCode, duplicate: outcome === "duplicate" }, { headers: { "Cache-Control": "no-store" } });
}