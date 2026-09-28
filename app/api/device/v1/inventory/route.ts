import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { nightlyDeviceCapabilities, nightlyDeviceSources, nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForManagement, createAuthError } from "@/lib/nightly-device/auth";

export async function GET(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });

  const [device] = await db
    .select({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, venueId: nightlyDevices.venueId, serialNumber: nightlyDevices.serialNumber, hardwareModel: nightlyDevices.hardwareModel, lifecycleState: nightlyDevices.lifecycleState, operationalState: nightlyDevices.operationalState, privacyMode: nightlyDevices.privacyMode })
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

  const capabilities = await db
    .select({
      category: nightlyDeviceCapabilities.category,
      name: nightlyDeviceCapabilities.capabilityName,
      value: nightlyDeviceCapabilities.capabilityValue,
      supported: nightlyDeviceCapabilities.supported,
    })
    .from(nightlyDeviceCapabilities)
    .where(eq(nightlyDeviceCapabilities.deviceId, device.id));
  const sources = await db
    .select({ sourceType: nightlyDeviceSources.sourceType, sourceLabel: nightlyDeviceSources.sourceLabel, venueCameraId: nightlyDeviceSources.venueCameraId, enabled: nightlyDeviceSources.enabled })
    .from(nightlyDeviceSources)
    .where(eq(nightlyDeviceSources.deviceId, device.id));

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      uuid: device.publicDeviceUuid,
      venueId: device.venueId,
      serialNumber: device.serialNumber,
      hardwareModel: device.hardwareModel,
      lifecycleState: device.lifecycleState,
      operationalState: device.operationalState,
      privacyMode: device.privacyMode,
    },
    capabilities,
    sources,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
