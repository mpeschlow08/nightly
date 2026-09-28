import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForManagement, createAuthError } from "@/lib/nightly-device/auth";

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const [device] = await db
    .select({
      id: nightlyDevices.id,
      publicDeviceUuid: nightlyDevices.publicDeviceUuid,
      venueId: nightlyDevices.venueId,
      lifecycleState: nightlyDevices.lifecycleState,
      operationalState: nightlyDevices.operationalState,
      claimState: nightlyDevices.claimState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      managementAccessLevel: nightlyDevices.managementAccessLevel,
      lastHeartbeatAt: nightlyDevices.lastHeartbeatAt,
      softwareVersion: nightlyDevices.softwareVersion,
      agentVersion: nightlyDevices.agentVersion,
    })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.id, identity.id))
    .limit(1);

  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      uuid: device.publicDeviceUuid,
      venueId: device.venueId,
      lifecycleState: device.lifecycleState,
      operationalState: device.operationalState,
      claimState: device.claimState,
      serviceEntitlementState: device.serviceEntitlementState,
      managementAccessLevel: device.managementAccessLevel,
      lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
      softwareVersion: device.softwareVersion,
      agentVersion: device.agentVersion,
      timestamp: new Date().toISOString(),
    },
  });
}
