import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { requireAdminActor } from "@/app/admin/lib/permissions";
import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { nightlyDevices } from "@/db/schema";
import { createAuthError, createBootstrapToken, hashDeviceSecret } from "@/lib/nightly-device/auth";

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch {
    return NextResponse.json(createAuthError("forbidden", "Active platform administrator access is required."), { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    serialNumber?: string;
    hardwareModel?: string;
    hardwareRevision?: string;
    manufacturingBatch?: string;
  } | null;

  if (!body || typeof body.serialNumber !== "string" || body.serialNumber.trim().length < 1 || body.serialNumber.length > 120) {
    return NextResponse.json(createAuthError("invalid_request", "A valid serial number is required."), { status: 400 });
  }

  const bootstrapToken = createBootstrapToken();
  const publicDeviceUuid = randomUUID();
  try {
    const device = await db.transaction(async (tx) => {
      const [created] = await tx.insert(nightlyDevices).values({
        publicDeviceUuid,
        serialNumber: body.serialNumber!.trim(),
        hardwareModel: body.hardwareModel?.slice(0, 120) ?? null,
        hardwareRevision: body.hardwareRevision?.slice(0, 120) ?? null,
        manufacturingBatch: body.manufacturingBatch?.slice(0, 120) ?? null,
        bootstrapTokenHash: hashDeviceSecret(bootstrapToken),
        lifecycleState: "inventory",
        provisioningState: "inventory",
        claimState: "unclaimed",
        operationalState: "starting",
      }).returning({ id: nightlyDevices.id, publicDeviceUuid: nightlyDevices.publicDeviceUuid, serialNumber: nightlyDevices.serialNumber });

      await writeAuditLog({
        actorClerkUserId: actor.clerkUserId,
        actorRole: "admin",
        entityType: "nightly_device",
        entityId: created.id,
        action: "device_enrolled",
        metadata: { serialNumber: created.serialNumber },
      }, tx);
      return created;
    });

    return NextResponse.json({ ok: true, device, bootstrapToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(createAuthError("enrollment_failed", "Device enrollment could not be completed."), { status: 409 });
  }
}