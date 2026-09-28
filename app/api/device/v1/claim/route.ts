import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { nightlyDeviceAssignments, nightlyDeviceClaims, nightlyDevices } from "@/db/schema";
import { canAccessVenueDevice, canBindUnassignedDevice, isDeviceClaimUsable } from "@/lib/nightly-device/policy";
import { createAuthError, getValidDeviceClaimForVenue, getVenueDeviceActor } from "@/lib/nightly-device/auth";

class ClaimBindingConflict extends Error {}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    deviceId?: number;
    publicDeviceUuid?: string;
    venueId?: number;
    claimCode?: string;
  } | null;

  if (!body || (!Number.isInteger(body.deviceId) && typeof body.publicDeviceUuid !== "string") || !Number.isInteger(body.venueId) || typeof body.claimCode !== "string") {
    return NextResponse.json(createAuthError("invalid_request", "Device, venue, and claim credentials are required."), { status: 400 });
  }

  const targetVenueId = body.venueId as number;
  const actor = await getVenueDeviceActor(targetVenueId);
  if (!actor) return NextResponse.json(createAuthError("unauthorized", "Venue authorization is required."), { status: 401 });
  if (!canAccessVenueDevice({ actor, deviceVenueId: targetVenueId, action: "lifecycle" })) {
    return NextResponse.json(createAuthError("forbidden", "Owner authorization is required for device claims."), { status: 403 });
  }

  const [device] = await db
    .select({
      id: nightlyDevices.id,
      venueId: nightlyDevices.venueId,
      publicDeviceUuid: nightlyDevices.publicDeviceUuid,
      claimState: nightlyDevices.claimState,
      lifecycleState: nightlyDevices.lifecycleState,
    })
    .from(nightlyDevices)
    .where(
      body.publicDeviceUuid
        ? eq(nightlyDevices.publicDeviceUuid, body.publicDeviceUuid)
        : eq(nightlyDevices.id, body.deviceId ?? 0)
    )
    .limit(1);

  if (!device) {
    return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  }

  if (!canBindUnassignedDevice(device)) {
    return NextResponse.json(createAuthError("device_unavailable", "Device is not eligible for a new claim."), { status: 409 });
  }

  const validClaim = await getValidDeviceClaimForVenue(device.id, targetVenueId, body.claimCode);
  if (!validClaim) {
    return NextResponse.json(createAuthError("claim_invalid", "Claim is invalid, expired, or already used."), { status: 400 });
  }
  if (validClaim.claimantClerkUserId !== actor.clerkUserId) {
    return NextResponse.json(createAuthError("claim_invalid", "Claim is invalid, expired, or already used."), { status: 403 });
  }

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, claimState: nightlyDevices.claimState, lifecycleState: nightlyDevices.lifecycleState })
      .from(nightlyDevices)
      .where(eq(nightlyDevices.id, device.id))
      .for("update");

    const [claim] = await tx.select().from(nightlyDeviceClaims).where(eq(nightlyDeviceClaims.id, validClaim.id)).for("update");
    const now = new Date();
    if (!existing || !claim || !canBindUnassignedDevice(existing) || !isDeviceClaimUsable(claim, now.getTime())) return null;

    const consumed = await tx
      .update(nightlyDeviceClaims)
      .set({
        status: "claimed",
        usedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(nightlyDeviceClaims.id, validClaim.id),
        eq(nightlyDeviceClaims.status, "pending"),
        isNull(nightlyDeviceClaims.usedAt),
        isNull(nightlyDeviceClaims.revokedAt),
        or(isNull(nightlyDeviceClaims.expiresAt), gt(nightlyDeviceClaims.expiresAt, now))
      ))
      .returning({ id: nightlyDeviceClaims.id });
    if (consumed.length !== 1) return null;

    const [updatedDevice] = await tx
      .update(nightlyDevices)
      .set({
        venueId: targetVenueId,
        lifecycleState: "claimed",
        claimState: "claimed",
        provisioningState: "provisioned",
        operationalState: "starting",
        activationAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(nightlyDevices.id, device.id),
        isNull(nightlyDevices.venueId),
        eq(nightlyDevices.claimState, "unclaimed"),
        inArray(nightlyDevices.lifecycleState, ["factory", "inventory", "provisioned", "unclaimed"])
      ))
      .returning({ id: nightlyDevices.id, venueId: nightlyDevices.venueId, claimState: nightlyDevices.claimState, lifecycleState: nightlyDevices.lifecycleState });

    if (!updatedDevice) throw new ClaimBindingConflict();
    await tx.insert(nightlyDeviceAssignments).values({
      deviceId: device.id,
      venueId: targetVenueId,
      assignedByClerkUserId: actor.clerkUserId,
      assignedAt: now,
      assignmentReason: "owner_claim",
      status: "active",
    });
    await writeAuditLog({
      actorClerkUserId: actor.clerkUserId,
      actorRole: actor.role,
      entityType: "nightly_device",
      entityId: device.id,
      action: "device_claimed",
      metadata: { venueId: targetVenueId },
    }, tx);

    return updatedDevice;
    });
  } catch (error) {
    if (error instanceof ClaimBindingConflict) {
      return NextResponse.json(createAuthError("claim_invalid", "Claim is invalid, expired, or already used."), { status: 409 });
    }
    return NextResponse.json(createAuthError("claim_failed", "Claim could not be completed."), { status: 500 });
  }

  if (!result) return NextResponse.json(createAuthError("claim_invalid", "Claim is invalid, expired, or already used."), { status: 409 });

  return NextResponse.json({
    ok: true,
    device: {
      id: result?.id,
      venueId: result?.venueId,
      lifecycleState: result?.lifecycleState,
      claimState: result?.claimState,
    },
    claim: { consumed: true },
    timestamp: new Date().toISOString(),
  });
}
