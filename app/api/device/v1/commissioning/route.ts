import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { nightlyDeviceCommissioningChecks, nightlyDevices } from "@/db/schema";
import { assertNotSecretPayload } from "@/lib/nightly-device/foundation";
import { authenticateDeviceRequest, canUseDeviceForOperationalManagement, createAuthError } from "@/lib/nightly-device/auth";
import { COMMISSIONING_CHECKS, normalizeCommissioningStatus } from "@/lib/nightly-device/policy";

export async function POST(request: Request) {
  const identity = await authenticateDeviceRequest(request);
  if (!identity) return NextResponse.json(createAuthError("unauthorized", "Device authentication is required."), { status: 401 });
  const body = (await request.json().catch(() => null)) as { checks?: unknown } | null;
  if (!body || !Array.isArray(body.checks) || body.checks.length > COMMISSIONING_CHECKS.length) {
    return NextResponse.json(createAuthError("invalid_request", "A bounded commissioning checks array is required."), { status: 400 });
  }

  const [device] = await db.select({ id: nightlyDevices.id, venueId: nightlyDevices.venueId })
    .from(nightlyDevices).where(eq(nightlyDevices.id, identity.id)).limit(1);
  if (!device) return NextResponse.json(createAuthError("device_not_found", "Device is not registered."), { status: 404 });
  if (!await canUseDeviceForOperationalManagement(device.id)) {
    return NextResponse.json(createAuthError("device_unavailable", "Device management access is unavailable."), { status: 403 });
  }

  const checks = body.checks as Array<Record<string, unknown>>;
  const seen = new Set<string>();
  const now = new Date();
  for (const check of checks) {
    if (!check || !COMMISSIONING_CHECKS.includes(check.checkKey as typeof COMMISSIONING_CHECKS[number]) || seen.has(String(check.checkKey)) || typeof check.summary !== "string" || check.summary.length > 500 || typeof check.checkedAt !== "string" || Number.isNaN(Date.parse(check.checkedAt)) || !check.evidence || typeof check.evidence !== "object" || Array.isArray(check.evidence)) {
      return NextResponse.json(createAuthError("invalid_commissioning", "Commissioning result is malformed."), { status: 400 });
    }
    seen.add(String(check.checkKey));
    const status = normalizeCommissioningStatus(check.status);
    if (status !== check.status) return NextResponse.json(createAuthError("invalid_commissioning", "Commissioning status is invalid."), { status: 400 });
    try { assertNotSecretPayload(check.evidence); } catch {
      return NextResponse.json(createAuthError("invalid_commissioning", "Sensitive commissioning evidence is not allowed."), { status: 400 });
    }
    if ((check.evidence as Record<string, unknown>).simulated === true && ["pass", "warning", "fail"].includes(status)) {
      return NextResponse.json(createAuthError("invalid_commissioning", "Simulated probes cannot create hardware result states."), { status: 400 });
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const check of checks) {
        await tx.insert(nightlyDeviceCommissioningChecks).values({
          deviceId: device.id,
          checkKey: check.checkKey as typeof nightlyDeviceCommissioningChecks.$inferInsert.checkKey,
          status: check.status as typeof nightlyDeviceCommissioningChecks.$inferInsert.status,
          summary: check.summary as string,
          evidenceJson: JSON.stringify(check.evidence),
          checkedAt: new Date(check.checkedAt as string),
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [nightlyDeviceCommissioningChecks.deviceId, nightlyDeviceCommissioningChecks.checkKey],
          set: {
            status: check.status as typeof nightlyDeviceCommissioningChecks.$inferInsert.status,
            summary: check.summary as string,
            evidenceJson: JSON.stringify(check.evidence),
            checkedAt: new Date(check.checkedAt as string),
            updatedAt: now,
          },
        });
      }
    });
  } catch (error) {
    const databaseError = error as { code?: unknown; constraint?: unknown };
    console.error("device_commissioning_update_failed", {
      code: typeof databaseError.code === "string" ? databaseError.code : "unknown",
      constraint: typeof databaseError.constraint === "string" ? databaseError.constraint : "unknown",
    });
    return NextResponse.json(createAuthError("commissioning_update_failed", "Commissioning results could not be saved."), { status: 500 });
  }

  return NextResponse.json({ ok: true, checkCount: checks.length, timestamp: now.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}