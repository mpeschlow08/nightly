import { NextResponse } from "next/server";

import { getHotReelProvider } from "@/lib/hot-reel/provider";
import { finalizeHotReelUpload, promoteHotMomentToHotReel } from "@/lib/hot-reel/core";
import type { HotReelLifecycleState, HotReelPublicationState, HotReelReviewState } from "@/lib/hot-reel/types";
import { authenticateDeviceRequest } from "@/lib/nightly-device/auth";

const headers = { "Cache-Control": "no-store" };
const allowedLifecycleStates: HotReelLifecycleState[] = ["local_ready", "upload_pending", "uploading", "uploaded", "processing", "ready", "failed", "expired", "deleting", "deleted"];
const allowedPublicationStates: HotReelPublicationState[] = ["private", "review", "published", "unpublished"];
const allowedReviewStates: HotReelReviewState[] = ["pending", "approved", "hidden"];

function isHotReelLifecycleState(value: unknown): value is HotReelLifecycleState {
  return typeof value === "string" && allowedLifecycleStates.includes(value as HotReelLifecycleState);
}

function isHotReelPublicationState(value: unknown): value is HotReelPublicationState {
  return typeof value === "string" && allowedPublicationStates.includes(value as HotReelPublicationState);
}

function isHotReelReviewState(value: unknown): value is HotReelReviewState {
  return typeof value === "string" && allowedReviewStates.includes(value as HotReelReviewState);
}

export async function POST(request: Request) {
  const device = await authenticateDeviceRequest(request);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Device authentication is required." }, { status: 401, headers });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ ok: false, error: "Request action is required." }, { status: 400, headers });
  }

  const provider = getHotReelProvider();
  const hotMomentId = typeof body.hotMomentId === "string" ? body.hotMomentId : null;
  const venueId = typeof body.venueId === "number" ? body.venueId : null;
  const deviceId = typeof body.deviceId === "number" ? body.deviceId : device.id;
  const sourceId = typeof body.sourceId === "number" ? body.sourceId : null;
  const durationMs = typeof body.durationMs === "number" ? body.durationMs : null;

  if (body.action === "create") {
    if (!hotMomentId || !venueId || !sourceId) {
      return NextResponse.json({ ok: false, error: "hotMomentId, venueId, and sourceId are required." }, { status: 400, headers });
    }

    const record = await promoteHotMomentToHotReel({
      hotMomentId,
      venueId,
      deviceId,
      sourceId,
      durationMs,
      provider,
      contentType: typeof body.contentType === "string" ? body.contentType : "video/mp4",
    });

    return NextResponse.json({ ok: true, record, upload: { objectKey: record.providerObjectKey, providerKey: record.providerKey } }, { status: 201, headers });
  }

  if (body.action === "finalize") {
    if (!body.record || typeof body.record !== "object") {
      return NextResponse.json({ ok: false, error: "A valid hot reel record is required." }, { status: 400, headers });
    }
    const record = body.record as Record<string, unknown>;
    const finalized = await finalizeHotReelUpload({
      record: {
        id: String(record.id ?? ""),
        publicId: String(record.publicId ?? ""),
        hotMomentId: String(record.hotMomentId ?? ""),
        venueId: Number(record.venueId ?? 0),
        deviceId: Number(record.deviceId ?? device.id),
        sourceId: Number(record.sourceId ?? 0),
        sessionId: record.sessionId == null ? null : Number(record.sessionId),
        lifecycleState: isHotReelLifecycleState(record.lifecycleState) ? record.lifecycleState : "upload_pending",
        publicationState: isHotReelPublicationState(record.publicationState) ? record.publicationState : "private",
        reviewState: isHotReelReviewState(record.reviewState) ? record.reviewState : "pending",
        providerKey: String(record.providerKey ?? provider.providerKey),
        providerObjectKey: record.providerObjectKey == null ? null : String(record.providerObjectKey),
        providerObjectVersion: Number(record.providerObjectVersion ?? 1),
        contentHash: record.contentHash == null ? null : String(record.contentHash),
        contentBytes: record.contentBytes == null ? null : Number(record.contentBytes),
        contentType: String(record.contentType ?? "video/mp4"),
        durationMs: record.durationMs == null ? null : Number(record.durationMs),
        capturedAt: record.capturedAt == null ? null : Number(record.capturedAt),
        uploadedAt: record.uploadedAt == null ? null : Number(record.uploadedAt),
        finalizedAt: record.finalizedAt == null ? null : Number(record.finalizedAt),
        expiresAt: record.expiresAt == null ? null : Number(record.expiresAt),
        deletedAt: record.deletedAt == null ? null : Number(record.deletedAt),
        failureCode: record.failureCode == null ? null : String(record.failureCode),
        failureReason: record.failureReason == null ? null : String(record.failureReason),
        metadata: record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : {},
        createdAt: Number(record.createdAt ?? Date.now()),
        updatedAt: Number(record.updatedAt ?? Date.now()),
      },
      provider,
      expectedBytes: typeof body.expectedBytes === "number" ? body.expectedBytes : undefined,
      expectedSha256: typeof body.expectedSha256 === "string" ? body.expectedSha256 : undefined,
    });

    return NextResponse.json({ ok: true, record: finalized }, { status: 200, headers });
  }

  return NextResponse.json({ ok: false, error: "Unsupported hot reel action." }, { status: 400, headers });
}
