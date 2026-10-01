import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { auditLogs, fleetDeviceAlerts, fleetDeviceOperations, fleetDeviceSnapshots, fleetSupportGrants, nightlyDeviceCommissioningChecks, nightlyDevices } from "@/db/schema";
import { canUseDeviceForManagement } from "@/lib/nightly-device/policy";
import { buildFleetSupportBundle } from "@/lib/nightly-device/support-bundle";
import { parseFleetTelemetry } from "@/lib/nightly-device/telemetry";
import { consumeRateLimit } from "@/lib/platform/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const actor = await requireAdminPermission("support:view").catch(() => null);
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rawId = (await params).deviceId;
  if (!/^\d{1,10}$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 3, sustainedLimit: 3, windowMs: 60_000, route: "admin:fleet:support-bundle" }).allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const deviceId = Number(rawId);
  const result = await db.transaction(async (tx) => {
    const [device] = await tx.select({ id: nightlyDevices.id, lifecycleState: nightlyDevices.lifecycleState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel, agentVersion: nightlyDevices.agentVersion, softwareVersion: nightlyDevices.softwareVersion, lastHeartbeatAt: nightlyDevices.lastHeartbeatAt })
      .from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).for("update").limit(1);
    if (!device || !canUseDeviceForManagement(device)) return { status: 404, body: "" };
    const now = new Date();
    const [grant] = await tx.select({ id: fleetSupportGrants.id, expiresAt: fleetSupportGrants.expiresAt })
      .from(fleetSupportGrants).where(and(eq(fleetSupportGrants.deviceId, deviceId), eq(fleetSupportGrants.actorClerkUserId, actor.clerkUserId), eq(fleetSupportGrants.scope, "device.collect_support_bundle"), isNull(fleetSupportGrants.revokedAt), gt(fleetSupportGrants.expiresAt, now))).for("update").limit(1);
    if (!grant) return { status: 403, body: "" };
    const [recent] = await tx.select({ total: count() }).from(auditLogs).where(and(eq(auditLogs.entityType, "nightly_device"), eq(auditLogs.entityId, String(deviceId)), eq(auditLogs.action, "fleet_support_bundle_issued"), gt(auditLogs.createdAt, new Date(now.getTime() - 15 * 60_000))));
    if (recent.total >= 3) return { status: 429, body: "" };
    const [snapshots, checks, alerts, operations] = await Promise.all([
      tx.select({ telemetryJson: fleetDeviceSnapshots.telemetryJson }).from(fleetDeviceSnapshots).where(eq(fleetDeviceSnapshots.deviceId, deviceId)).limit(1),
      tx.select({ key: nightlyDeviceCommissioningChecks.checkKey, status: nightlyDeviceCommissioningChecks.status }).from(nightlyDeviceCommissioningChecks).where(eq(nightlyDeviceCommissioningChecks.deviceId, deviceId)).limit(16),
      tx.select({ code: fleetDeviceAlerts.code, severity: fleetDeviceAlerts.severity, state: fleetDeviceAlerts.state }).from(fleetDeviceAlerts).where(eq(fleetDeviceAlerts.deviceId, deviceId)).orderBy(desc(fleetDeviceAlerts.lastObservedAt)).limit(20),
      tx.select({ type: fleetDeviceOperations.type, state: fleetDeviceOperations.state, resultCode: fleetDeviceOperations.resultCode }).from(fleetDeviceOperations).where(eq(fleetDeviceOperations.deviceId, deviceId)).orderBy(desc(fleetDeviceOperations.createdAt)).limit(20),
    ]);
    let telemetry = null;
    try { telemetry = parseFleetTelemetry(JSON.parse(snapshots[0]?.telemetryJson ?? "null")); } catch { telemetry = null; }
    if (grant.expiresAt <= new Date()) return { status: 403, body: "" };
    const body = buildFleetSupportBundle({ deviceId, agentVersion: device.agentVersion, softwareVersion: device.softwareVersion, lastHeartbeatAt: device.lastHeartbeatAt, telemetry, checks, alerts, operations }, now);
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "nightly_device", entityId: String(deviceId), action: "fleet_support_bundle_issued", metadataJson: JSON.stringify({ grantId: grant.id, bytes: Buffer.byteLength(body) }) });
    return { status: 200, body };
  });
  if (result.status !== 200) return NextResponse.json({ error: result.status === 429 ? "rate_limited" : result.status === 403 ? "support_authorization_required" : "not_found" }, { status: result.status });
  return new Response(result.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="nightly-support-${deviceId}.json"`, "Cache-Control": "no-store" } });
}