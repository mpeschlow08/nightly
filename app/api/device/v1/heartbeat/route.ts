import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { fleetDeviceSnapshots, nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForManagement, createAuthError } from "@/lib/nightly-device/auth";
import { parseFleetTelemetry, readBoundedJson } from "@/lib/nightly-device/telemetry";
import { fleetAlertConditions, reconcileFleetAlerts } from "@/lib/nightly-device/fleet-alerts";
import { canUseDeviceForManagement as managementAllowed } from "@/lib/nightly-device/policy";

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });
  let body: { agentVersion?: unknown; softwareVersion?: unknown; operationalState?: unknown; telemetry?: unknown };
  try {
    body = (await readBoundedJson(request)) as typeof body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["agentVersion", "softwareVersion", "operationalState", "telemetry"].includes(key))) throw new Error("invalid_body");
  } catch {
    return NextResponse.json(createAuthError("invalid_request", "A bounded heartbeat payload is required."), { status: 400 });
  }
  if ((body.agentVersion !== undefined && (typeof body.agentVersion !== "string" || body.agentVersion.length > 64)) ||
      (body.softwareVersion !== undefined && (typeof body.softwareVersion !== "string" || body.softwareVersion.length > 64)) ||
      (body.operationalState !== undefined && body.operationalState !== "healthy" && body.operationalState !== "degraded") ||
      (body.telemetry !== undefined && !parseFleetTelemetry(body.telemetry))) {
    return NextResponse.json(createAuthError("invalid_request", "Heartbeat fields are invalid."), { status: 400 });
  }
  const device = identity;
  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx.select({ venueId: nightlyDevices.venueId, lifecycleState: nightlyDevices.lifecycleState, operationalState: nightlyDevices.operationalState, serviceEntitlementState: nightlyDevices.serviceEntitlementState, managementRecoveryEligible: nightlyDevices.managementRecoveryEligible, managementAccessLevel: nightlyDevices.managementAccessLevel })
      .from(nightlyDevices).where(eq(nightlyDevices.id, device.id)).for("update").limit(1);
    if (!current || !managementAllowed(current)) return null;
    const now = new Date();
    const operationalState = current.lifecycleState === "active" ? (body.operationalState ?? "healthy") as "healthy" | "degraded" : current.operationalState;
    await tx.update(nightlyDevices).set({
      lastHeartbeatAt: now,
      ...(body.agentVersion !== undefined ? { agentVersion: body.agentVersion as string } : {}),
      ...(body.softwareVersion !== undefined ? { softwareVersion: body.softwareVersion as string } : {}),
      operationalState,
      updatedAt: now,
    }).where(eq(nightlyDevices.id, device.id));
    if (body.telemetry) await tx.insert(fleetDeviceSnapshots).values({
      deviceId: device.id, telemetryJson: JSON.stringify(body.telemetry), receivedAt: now,
    }).onConflictDoUpdate({ target: fleetDeviceSnapshots.deviceId, set: { telemetryJson: JSON.stringify(body.telemetry), receivedAt: now } });
    return { current, now, operationalState };
  });
  if (!outcome) return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  const { current, now, operationalState } = outcome;
  if (body.telemetry) {
    await reconcileFleetAlerts(device.id, fleetAlertConditions({
      connectivity: "online",
      commercialState: current.serviceEntitlementState,
      telemetry: parseFleetTelemetry(body.telemetry),
    }), now);
  } else await reconcileFleetAlerts(device.id, [], now, ["DEVICE_OFFLINE"]);

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      uuid: device.publicDeviceUuid,
      venueId: current.venueId,
      status: current.lifecycleState,
      serviceEntitlementState: current.serviceEntitlementState,
      operationalState,
      timestamp: now.toISOString(),
    },
  });
}
