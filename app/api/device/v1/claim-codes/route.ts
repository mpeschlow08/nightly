import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { nightlyDeviceClaims, nightlyDevices } from "@/db/schema";
import { createAuthError, getVenueDeviceActor, hashDeviceSecret, isSafeDeviceBootstrapToken } from "@/lib/nightly-device/auth";
import { canAccessVenueDevice, canBindUnassignedDevice } from "@/lib/nightly-device/policy";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    publicDeviceUuid?: string;
    venueId?: number;
    claimCode?: string;
  } | null;

  if (!body || typeof body.publicDeviceUuid !== "string" || !Number.isInteger(body.venueId) || !isSafeDeviceBootstrapToken(body.claimCode ?? "")) {
    return NextResponse.json(createAuthError("invalid_request", "Device, venue, and one-time claim data are required."), { status: 400 });
  }

  const venueId = body.venueId as number;
  const actor = await getVenueDeviceActor(venueId);
  if (!actor) return NextResponse.json(createAuthError("unauthorized", "Venue authorization is required."), { status: 401 });
  if (!canAccessVenueDevice({ actor, deviceVenueId: venueId, action: "lifecycle" })) {
    return NextResponse.json(createAuthError("forbidden", "Owner authorization is required to issue a claim."), { status: 403 });
  }

  const [device] = await db
    .select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, claimState: nightlyDevices.claimState, lifecycleState: nightlyDevices.lifecycleState })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.publicDeviceUuid, body.publicDeviceUuid))
    .limit(1);

  if (!device) return NextResponse.json(createAuthError("device_unavailable", "Device is not eligible for claiming."), { status: 404 });
  if (!canBindUnassignedDevice(device)) return NextResponse.json(createAuthError("device_unavailable", "Device is not eligible for claiming."), { status: 409 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const claimCodeHash = hashDeviceSecret(body.claimCode!);
  const created = await db.transaction(async (tx) => {
    const [lockedDevice] = await tx
      .select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, claimState: nightlyDevices.claimState, lifecycleState: nightlyDevices.lifecycleState })
      .from(nightlyDevices)
      .where(eq(nightlyDevices.id, device.id))
      .for("update");
    if (!lockedDevice || !canBindUnassignedDevice(lockedDevice)) return false;

    await tx.update(nightlyDeviceClaims)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(and(eq(nightlyDeviceClaims.deviceId, device.id), eq(nightlyDeviceClaims.status, "pending")));

    await tx.insert(nightlyDeviceClaims).values({
      deviceId: device.id,
      venueId,
      claimantClerkUserId: actor.clerkUserId,
      claimCodeHash,
      status: "pending",
      expiresAt,
    });
    return true;
  });

  if (!created) return NextResponse.json(createAuthError("device_unavailable", "Device is not eligible for claiming."), { status: 409 });
  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}