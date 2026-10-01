import { and, count, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { auditLogs, fleetDeviceAlerts, fleetDeviceSnapshots, fleetSupportGrants, nightlyDevices } from "@/db/schema";
import { canUseDeviceForManagement } from "@/lib/nightly-device/policy";
import { parseFleetTelemetry } from "@/lib/nightly-device/telemetry";
import { safeVersion } from "@/lib/nightly-device/support-bundle";
import { consumeRateLimit } from "@/lib/platform/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const actor = await requireAdminPermission("support:view").catch(() => null);
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rawId = (await params).deviceId;
  if (!/^\d{1,10}$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const deviceId = Number(rawId);
  if (!consumeRateLimit({ key: actor.clerkUserId, scope: "user", burstLimit: 10, sustainedLimit: 10, windowMs: 60_000, route: "admin:fleet:diagnostics" }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const outcome = await db.transaction(async (tx) => {
    const [device] = await tx.select({ id: nightlyDevices.id, lifecycleState: nightlyDevices.lifecycleState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel, agentVersion: nightlyDevices.agentVersion, softwareVersion: nightlyDevices.softwareVersion, lastHeartbeatAt: nightlyDevices.lastHeartbeatAt, appliedConfigRevision: nightlyDevices.appliedConfigRevision, serviceEntitlementState: nightlyDevices.serviceEntitlementState })
      .from(nightlyDevices).where(eq(nightlyDevices.id, deviceId)).for("update").limit(1);
    if (!device || !canUseDeviceForManagement(device)) return { status: 404 as const };
    const now = new Date();
    const [grant] = await tx.select({ id: fleetSupportGrants.id, expiresAt: fleetSupportGrants.expiresAt }).from(fleetSupportGrants).where(and(
      eq(fleetSupportGrants.deviceId, deviceId), eq(fleetSupportGrants.actorClerkUserId, actor.clerkUserId),
      eq(fleetSupportGrants.scope, "device.read_diagnostics"), gt(fleetSupportGrants.expiresAt, now), isNull(fleetSupportGrants.revokedAt),
    )).for("update").limit(1);
    if (!grant) return { status: 403 as const };
    const [recent] = await tx.select({ total: count() }).from(auditLogs).where(and(
      eq(auditLogs.entityType, "nightly_device"), eq(auditLogs.entityId, String(deviceId)), eq(auditLogs.action, "fleet_diagnostics_read"), gt(auditLogs.createdAt, new Date(now.getTime() - 15 * 60_000)),
    ));
    if (recent.total >= 30) return { status: 429 as const };
    const [snapshots, alerts] = await Promise.all([
      tx.select({ receivedAt: fleetDeviceSnapshots.receivedAt, telemetryJson: fleetDeviceSnapshots.telemetryJson }).from(fleetDeviceSnapshots)
        .where(eq(fleetDeviceSnapshots.deviceId, deviceId)).limit(1),
      tx.select({ code: fleetDeviceAlerts.code, severity: fleetDeviceAlerts.severity }).from(fleetDeviceAlerts)
        .where(and(eq(fleetDeviceAlerts.deviceId, deviceId), ne(fleetDeviceAlerts.state, "resolved")))
        .orderBy(desc(fleetDeviceAlerts.lastObservedAt)).limit(20),
    ]);
    if (grant.expiresAt <= new Date()) return { status: 403 as const };
    let telemetry = null;
    try { telemetry = parseFleetTelemetry(JSON.parse(snapshots[0]?.telemetryJson ?? "null")); } catch { telemetry = null; }
    await tx.insert(auditLogs).values({ actorClerkUserId: actor.clerkUserId, actorRole: "admin", entityType: "nightly_device", entityId: String(deviceId), action: "fleet_diagnostics_read", metadataJson: JSON.stringify({ grantId: grant.id }) });
    return { status: 200 as const, body: { deviceId, agentVersion: safeVersion(device.agentVersion), softwareVersion: safeVersion(device.softwareVersion), serviceEntitlementState: device.serviceEntitlementState,
      lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null, appliedConfigRevision: device.appliedConfigRevision,
      telemetryReceivedAt: snapshots[0]?.receivedAt.toISOString() ?? null, telemetry, alerts } };
  });
  if (outcome.status !== 200) return NextResponse.json({ error: outcome.status === 429 ? "rate_limited" : outcome.status === 404 ? "not_found" : "support_authorization_required" }, { status: outcome.status });
  return NextResponse.json(outcome.body, { headers: { "Cache-Control": "no-store" } });
}