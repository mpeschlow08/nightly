import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

import { requireAdminActor } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { nightlyDeviceClaims, nightlyDevices, venueMembers, venueStaffProfiles, venues } from "@/db/schema";
import { canAccessVenueDevice, canUseDeviceForManagement as managementAllowed, canUseDeviceForOperationalManagement as operationalManagementAllowed, canUseDeviceForService as serviceAllowed, isDeviceClaimUsable } from "./policy";

export type DeviceBootstrapIdentity = {
  deviceId: number;
  publicDeviceUuid: string;
  venueId: number | null;
  lifecycleState: string;
  claimState: string;
  serviceEntitlementState: string;
  managementAccessLevel: string;
  serviceSuspendedAt: Date | null;
  managementRecoveryEligible: boolean;
};

export function createBootstrapToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function isSafeDeviceBootstrapToken(token: string) {
  return typeof token === "string" && token.length >= 24 && /^[A-Za-z0-9_-]+$/.test(token);
}

export async function getDeviceBootstrapIdentity(deviceId: number): Promise<DeviceBootstrapIdentity | null> {
  const [device] = await db
    .select({
      id: nightlyDevices.id,
      publicDeviceUuid: nightlyDevices.publicDeviceUuid,
      venueId: nightlyDevices.venueId,
      lifecycleState: nightlyDevices.lifecycleState,
      claimState: nightlyDevices.claimState,
      serviceEntitlementState: nightlyDevices.serviceEntitlementState,
      managementAccessLevel: nightlyDevices.managementAccessLevel,
      serviceSuspendedAt: nightlyDevices.serviceSuspendedAt,
      managementRecoveryEligible: nightlyDevices.managementRecoveryEligible,
    })
    .from(nightlyDevices)
    .where(eq(nightlyDevices.id, deviceId))
    .limit(1);

  if (!device) {
    return null;
  }

  return {
    deviceId: device.id,
    publicDeviceUuid: device.publicDeviceUuid,
    venueId: device.venueId,
    lifecycleState: device.lifecycleState,
    claimState: device.claimState,
    serviceEntitlementState: device.serviceEntitlementState,
    managementAccessLevel: device.managementAccessLevel,
    serviceSuspendedAt: device.serviceSuspendedAt,
    managementRecoveryEligible: device.managementRecoveryEligible,
  };
}

export async function canUseDeviceForService(deviceId: number) {
  const record = await getDeviceBootstrapIdentity(deviceId);
  if (!record) return false;
  return serviceAllowed(record);
}

export async function canUseDeviceForManagement(deviceId: number) {
  const record = await getDeviceBootstrapIdentity(deviceId);
  if (!record) return false;
  return managementAllowed(record);
}

export async function canUseDeviceForOperationalManagement(deviceId: number) {
  const record = await getDeviceBootstrapIdentity(deviceId);
  if (!record) return false;
  return operationalManagementAllowed(record);
}

export async function canActorAccessVenueDevice(input: {
  venueId: number;
  deviceVenueId: number | null;
  action: "view" | "operate" | "lifecycle";
}) {
  const actor = await getVenueDeviceActor(input.venueId);
  return Boolean(actor && canAccessVenueDevice({
    actor,
    deviceVenueId: input.deviceVenueId,
    action: input.action,
  }) && actor);
}

export async function getVenueDeviceActor(venueId: number) {
  try {
    const admin = await requireAdminActor();
    return { clerkUserId: admin.clerkUserId, role: "admin" as const, venueId: null };
  } catch {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return null;

    const [membership] = await db
      .select({ role: venueMembers.role })
      .from(venueMembers)
      .where(and(eq(venueMembers.clerkUserId, clerkUserId), eq(venueMembers.venueId, venueId)))
      .limit(1);

    if (membership?.role === "owner") {
      return { clerkUserId, role: "owner" as const, venueId };
    }

    if (membership?.role === "manager") {
      return { clerkUserId, role: "manager" as const, venueId };
    }

    const [staff] = await db
      .select({ permissionsJson: venueStaffProfiles.permissionsJson })
      .from(venueStaffProfiles)
      .where(
        and(
          eq(venueStaffProfiles.clerkUserId, clerkUserId),
          eq(venueStaffProfiles.venueId, venueId),
          eq(venueStaffProfiles.status, "active")
        )
      )
      .limit(1);

    if (staff && parsePermissionList(staff.permissionsJson).includes("nightly_device:operate")) {
      return { clerkUserId, role: "tech_operator" as const, venueId };
    }

    return { clerkUserId, role: "unrelated" as const, venueId: null };
  }
}

export async function getCurrentVenueDeviceActor() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const [membership] = await db
    .select({ venueId: venues.id, venueName: venues.name, role: venueMembers.role })
    .from(venueMembers)
    .innerJoin(venues, eq(venueMembers.venueId, venues.id))
    .where(eq(venueMembers.clerkUserId, clerkUserId))
    .limit(1);

  if (membership && (membership.role === "owner" || membership.role === "manager")) {
    return { clerkUserId, venueId: membership.venueId, venueName: membership.venueName, role: membership.role };
  }

  const [staff] = await db
    .select({ venueId: venues.id, venueName: venues.name, permissionsJson: venueStaffProfiles.permissionsJson })
    .from(venueStaffProfiles)
    .innerJoin(venues, eq(venueStaffProfiles.venueId, venues.id))
    .where(and(
      eq(venueStaffProfiles.clerkUserId, clerkUserId),
      eq(venueStaffProfiles.status, "active")
    ))
    .limit(1);

  if (!staff || !parsePermissionList(staff.permissionsJson).includes("nightly_device:operate")) return null;
  return { clerkUserId, venueId: staff.venueId, venueName: staff.venueName, role: "tech_operator" as const };
}

function parsePermissionList(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

export async function authenticateDeviceRequest(request: Request) {
  const publicDeviceUuid = request.headers.get("x-nightly-device-uuid");
  const authorization = request.headers.get("authorization");
  const secret = authorization?.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i)?.[1];
  if (!publicDeviceUuid || !secret) return null;

  const [device] = await db
    .select()
    .from(nightlyDevices)
    .where(eq(nightlyDevices.publicDeviceUuid, publicDeviceUuid))
    .limit(1);

  if (!device?.deviceSecretHash || !secureCompare(hashDeviceSecret(secret), device.deviceSecretHash)) return null;
  return device;
}

export async function getValidDeviceClaimForVenue(deviceId: number, venueId: number, claimCode: string) {
  const [claim] = await db
    .select()
    .from(nightlyDeviceClaims)
    .where(eq(nightlyDeviceClaims.claimCodeHash, hashDeviceSecret(claimCode)))
    .limit(1);

  if (!claim) {
    return null;
  }

  if (claim.deviceId !== deviceId) {
    return null;
  }

  if (claim.venueId !== venueId) {
    return null;
  }

  if (!isDeviceClaimUsable(claim)) {
    return null;
  }

  return claim;
}

export function createAuthError(code: string, message: string) {
  return {
    error: {
      code,
      message,
    },
  };
}

export function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
