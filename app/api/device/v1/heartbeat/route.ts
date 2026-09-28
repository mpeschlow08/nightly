import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForManagement, createAuthError } from "@/lib/nightly-device/auth";

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { agentVersion?: unknown; softwareVersion?: unknown; operationalState?: unknown };
  if ((body.agentVersion !== undefined && (typeof body.agentVersion !== "string" || body.agentVersion.length > 64)) ||
      (body.softwareVersion !== undefined && (typeof body.softwareVersion !== "string" || body.softwareVersion.length > 64)) ||
      (body.operationalState !== undefined && body.operationalState !== "healthy" && body.operationalState !== "degraded")) {
    return NextResponse.json(createAuthError("invalid_request", "Version identifiers must be strings of at most 64 characters."), { status: 400 });
  }
  const device = identity;
  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  const [current] = await db.select({ venueId: nightlyDevices.venueId, lifecycleState: nightlyDevices.lifecycleState, operationalState: nightlyDevices.operationalState, serviceEntitlementState: nightlyDevices.serviceEntitlementState }).from(nightlyDevices).where(eq(nightlyDevices.id, device.id)).limit(1);
  if (!current) return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });

  await db
    .update(nightlyDevices)
    .set({
      lastHeartbeatAt: new Date(),
      ...(body.agentVersion !== undefined ? { agentVersion: body.agentVersion } : {}),
      ...(body.softwareVersion !== undefined ? { softwareVersion: body.softwareVersion } : {}),
      operationalState: current.lifecycleState === "active" ? (body.operationalState ?? "healthy") as "healthy" | "degraded" : current.operationalState,
      updatedAt: new Date(),
    })
    .where(eq(nightlyDevices.id, device.id));

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      uuid: device.publicDeviceUuid,
      venueId: current.venueId,
      status: current.lifecycleState,
      serviceEntitlementState: current.serviceEntitlementState,
      operationalState: current.operationalState,
      timestamp: new Date().toISOString(),
    },
  });
}
