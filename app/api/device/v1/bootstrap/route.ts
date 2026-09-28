import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { nightlyDevices } from "@/db/schema";
import { createAuthError, createBootstrapToken, hashDeviceSecret, isSafeDeviceBootstrapToken, secureCompare } from "@/lib/nightly-device/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    publicDeviceUuid?: string;
    serialNumber?: string;
    bootstrapToken?: string;
  } | null;

  if (!body || typeof body.publicDeviceUuid !== "string" || typeof body.serialNumber !== "string") {
    return NextResponse.json(createAuthError("invalid_request", "publicDeviceUuid and serialNumber are required."), { status: 400 });
  }

  if (!isSafeDeviceBootstrapToken(body.bootstrapToken ?? "")) {
    return NextResponse.json(createAuthError("invalid_bootstrap", "A valid bootstrap token is required."), { status: 400 });
  }

  const [device] = await db
    .select({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, serialNumber: nightlyDevices.serialNumber, bootstrapTokenHash: nightlyDevices.bootstrapTokenHash, lifecycleState: nightlyDevices.lifecycleState, provisioningState: nightlyDevices.provisioningState })
    .from(nightlyDevices)
    .where(and(eq(nightlyDevices.publicDeviceUuid, body.publicDeviceUuid), eq(nightlyDevices.serialNumber, body.serialNumber)))
    .limit(1);

  if (!device?.bootstrapTokenHash || !secureCompare(hashDeviceSecret(body.bootstrapToken ?? ""), device.bootstrapTokenHash)) {
    return NextResponse.json(createAuthError("bootstrap_denied", "Device bootstrap could not be authorized."), { status: 401 });
  }

  if (device.lifecycleState === "revoked" || device.lifecycleState === "retired" || !["inventory", "factory", "provisioned"].includes(device.lifecycleState)) {
    return NextResponse.json(createAuthError("bootstrap_denied", "Device bootstrap could not be authorized."), { status: 403 });
  }

  const deviceSecret = createBootstrapToken();
  const [activated] = await db
    .update(nightlyDevices)
    .set({
      bootstrapTokenHash: null,
      deviceSecretHash: hashDeviceSecret(deviceSecret),
      lifecycleState: "provisioned",
      provisioningState: "provisioned",
      provisioningAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(nightlyDevices.id, device.id), eq(nightlyDevices.bootstrapTokenHash, device.bootstrapTokenHash), inArray(nightlyDevices.lifecycleState, ["inventory", "factory", "provisioned"])))
    .returning({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, serialNumber: nightlyDevices.serialNumber, lifecycleState: nightlyDevices.lifecycleState, claimState: nightlyDevices.claimState });

  if (!activated) {
    return NextResponse.json(createAuthError("bootstrap_denied", "Device bootstrap could not be authorized."), { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    device: {
      ...activated,
    },
    deviceSecret,
  }, { headers: { "Cache-Control": "no-store" } });
}
