import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { nightlyDeviceCapabilities, nightlyDevices } from "@/db/schema";
import { authenticateDeviceRequest, canUseDeviceForOperationalManagement, createAuthError } from "@/lib/nightly-device/auth";
import { validateDeviceCapabilityBundle, type DeviceCapabilityRecord } from "@/lib/nightly-device/foundation";

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });
  const body = (await request.json().catch(() => null)) as { capabilities?: unknown } | null;
  if (!body || !Array.isArray(body.capabilities)) return NextResponse.json(createAuthError("invalid_request", "A capabilities array is required."), { status: 400 });

  try {
    validateDeviceCapabilityBundle(body.capabilities as Parameters<typeof validateDeviceCapabilityBundle>[0]);
  } catch {
    return NextResponse.json(createAuthError("invalid_capabilities", "Capability payload is invalid or contains sensitive data."), { status: 400 });
  }
  const capabilities = body.capabilities as DeviceCapabilityRecord[];

  const [device] = await db
    .select({ id: nightlyDevices.id })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.id, identity.id))
    .limit(1);

  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  const allowed = await canUseDeviceForOperationalManagement(device.id);
  if (!allowed) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(nightlyDeviceCapabilities).where(eq(nightlyDeviceCapabilities.deviceId, device.id));
    if (capabilities.length > 0) {
      await tx.insert(nightlyDeviceCapabilities).values(
        capabilities.map((capability) => ({
        deviceId: device.id,
        category: capability.category,
        capabilityName: capability.name,
        capabilityValue: capability.value == null ? null : String(capability.value),
        supported: capability.supported,
        metadataJson: JSON.stringify(capability.metadata ?? {}),
        }))
      );
    }
  });

  return NextResponse.json({
    ok: true,
    deviceId: device.id,
    capabilityCount: capabilities.length,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
