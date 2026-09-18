import "server-only";

import { and, eq } from "drizzle-orm";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import { venueCameras } from "@/db/schema";
import { logger } from "@/lib/platform/logger";

import { getLiveStreamProvider } from "./provider";
import { provisionLiveInputForCameraCore } from "./provisioning-core";
import { mapNightlyStreamState } from "./stream-state";

export async function provisionLiveInputForCamera(input: {
  cameraId: number;
  actorClerkUserId: string;
  actorRole: string;
}) {
  const [camera] = await db
    .select()
    .from(venueCameras)
    .where(eq(venueCameras.id, input.cameraId))
    .limit(1);

  if (!camera) {
    throw new Error("Camera not found.");
  }

  const provider = getLiveStreamProvider();
  const now = new Date();
  try {
    const result = await provisionLiveInputForCameraCore({
      camera,
      provider,
      now,
      store: {
        setProvisioningPending: async (cameraId) => {
          await db
            .update(venueCameras)
            .set({
              provisioningStatus: "provisioning",
              lastProvisioningError: null,
            })
            .where(eq(venueCameras.id, cameraId));
        },
        markReady: async ({ cameraId, provider, descriptor, now }) => {
          await db
            .update(venueCameras)
            .set({
              liveProvider: provider,
              providerLiveInputId: descriptor.liveInputId,
              providerPlaybackId: descriptor.playbackId,
              provisioningStatus: "ready",
              lastKnownStreamStatus: descriptor.providerStatus,
              lastHealthCheckAt: now,
              lastProvisionedAt: now,
              lastProvisioningError: null,
            })
            .where(eq(venueCameras.id, cameraId));
        },
        markReadyExisting: async ({ cameraId, descriptor, now }) => {
          await db
            .update(venueCameras)
            .set({
              provisioningStatus: "ready",
              providerPlaybackId: descriptor.playbackId,
              lastKnownStreamStatus: descriptor.providerStatus,
              lastHealthCheckAt: now,
              lastProvisioningError: null,
            })
            .where(eq(venueCameras.id, cameraId));
        },
        markError: async ({ cameraId, message }) => {
          await db
            .update(venueCameras)
            .set({
              provisioningStatus: "error",
              lastProvisioningError: message,
            })
            .where(eq(venueCameras.id, cameraId));
        },
      },
    });

    await writeAuditLog({
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      entityType: "venue_camera",
      entityId: camera.id,
      action: "live_stream_provisioned",
      metadata: {
        venueId: camera.venueId,
        provider: provider.providerKey,
        providerLiveInputId: result.liveInputId,
      },
    });

    logger.info("playback_provisioned", {
      venueId: camera.venueId,
      cameraId: camera.id,
      provider: provider.providerKey,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning failed.";

    await writeAuditLog({
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      entityType: "venue_camera",
      entityId: camera.id,
      action: "live_stream_provision_failed",
      metadata: {
        venueId: camera.venueId,
        provider: provider.providerKey,
        error: message,
      },
    });

    logger.error("playback_provision_failed", {
      venueId: camera.venueId,
      cameraId: camera.id,
      provider: provider.providerKey,
      reason: message,
    });

    throw error;
  }
}

export async function refreshCameraStreamHealth(cameraId: number) {
  const [camera] = await db
    .select()
    .from(venueCameras)
    .where(and(eq(venueCameras.id, cameraId), eq(venueCameras.status, "enabled")))
    .limit(1);

  if (!camera?.providerLiveInputId) {
    return {
      streamState: mapNightlyStreamState({
        cameraEnabled: camera?.status === "enabled",
        provisioningStatus: camera?.provisioningStatus,
        providerStatus: null,
      }),
      providerStatus: null,
      activeVideoId: null,
    };
  }

  const provider = getLiveStreamProvider();
  const health = await provider.getStreamHealth(camera.providerLiveInputId);
  const now = new Date();

  await db
    .update(venueCameras)
    .set({
      lastKnownStreamStatus: health.providerStatus,
      lastHealthCheckAt: now,
      provisioningStatus: camera.provisioningStatus === "error" ? camera.provisioningStatus : "ready",
    })
    .where(eq(venueCameras.id, camera.id));

  return {
    streamState: mapNightlyStreamState({
      cameraEnabled: camera.status === "enabled",
      provisioningStatus: camera.provisioningStatus,
      providerStatus: health.providerStatus,
      lifecycleLive: health.isLive,
    }),
    providerStatus: health.providerStatus,
    activeVideoId: health.activeVideoId,
    playbackHost: health.playbackHost,
  };
}
