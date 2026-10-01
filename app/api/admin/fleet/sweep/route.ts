import { and, asc, gt, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auditLogs, nightlyDevices } from "@/db/schema";
import { reconcileOfflineAlertsForDevices } from "@/lib/nightly-device/fleet-alerts";
import { pruneFleetHistoryForDevices } from "@/lib/nightly-device/fleet-retention";
import { authorizedFleetSweep } from "@/lib/nightly-device/fleet-sweep-auth";
import { readBoundedJson } from "@/lib/nightly-device/telemetry";

export async function POST(request: Request) {
  if (!authorizedFleetSweep(request.headers.get("authorization"), process.env.NIGHTLY_FLEET_SWEEP_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { cursor?: unknown; limit?: unknown; deviceIds?: unknown; requestId?: unknown };
  try { body = await readBoundedJson(request, 512) as typeof body; }
  catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["cursor", "limit", "deviceIds", "requestId"].includes(key)) ||
    typeof body.requestId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(body.requestId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const cursor = body.cursor === undefined ? 0 : body.cursor;
  const limit = body.limit === undefined ? 100 : body.limit;
  if (!Number.isSafeInteger(cursor) || (cursor as number) < 0 || !Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 100) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const deviceIds = body.deviceIds;
  if (deviceIds !== undefined && (!Array.isArray(deviceIds) || deviceIds.length < 1 || deviceIds.length > 100 ||
    deviceIds.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(deviceIds).size !== deviceIds.length)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const outcome = await db.transaction(async (tx) => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(1718245340) as acquired`);
    if ((lock.rows[0] as { acquired?: boolean } | undefined)?.acquired !== true) return null;
    const rows = await tx.select({ id: nightlyDevices.id }).from(nightlyDevices)
      .where(and(gt(nightlyDevices.id, cursor as number), deviceIds ? inArray(nightlyDevices.id, deviceIds as number[]) : undefined))
      .orderBy(asc(nightlyDevices.id)).limit(limit as number);
    const ids = rows.map((row) => row.id);
    if (ids.length) {
      await reconcileOfflineAlertsForDevices(ids);
      const deleted = await pruneFleetHistoryForDevices(ids);
      await tx.insert(auditLogs).values({ actorClerkUserId: "fleet-scheduler", actorRole: "service", entityType: "fleet", entityId: "reconciliation", action: "fleet_sweep_completed", metadataJson: JSON.stringify({ requestId: body.requestId, count: ids.length, cursor, ...deleted }) });
    }
    return { processed: ids.length, nextCursor: ids.length === limit ? rows.at(-1)?.id ?? null : null };
  });
  if (!outcome) return NextResponse.json({ error: "busy" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, ...outcome }, { headers: { "Cache-Control": "no-store" } });
}