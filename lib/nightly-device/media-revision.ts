import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import type { db } from "../../db";
import { nightlyDevices, nightlyDeviceSources } from "../../db/schema";

type MediaRevisionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getBoundCameraDeviceIds(
  tx: MediaRevisionTransaction,
  venueId: number,
  cameraId: number
) {
  const sources = await tx
    .select({ deviceId: nightlyDeviceSources.deviceId })
    .from(nightlyDeviceSources)
    .where(and(
      eq(nightlyDeviceSources.venueId, venueId),
      eq(nightlyDeviceSources.venueCameraId, cameraId)
    ));

  return sources.map((source) => source.deviceId);
}

export async function rotateCameraMediaRevision(
  tx: MediaRevisionTransaction,
  venueId: number,
  cameraId: number,
  capturedDeviceIds?: number[]
) {
  const deviceIds = capturedDeviceIds ?? await getBoundCameraDeviceIds(tx, venueId, cameraId);
  if (deviceIds.length === 0) return;

  await tx.update(nightlyDevices).set({
    desiredConfigRevision: randomUUID(),
    updatedAt: new Date(),
  }).where(and(
    eq(nightlyDevices.venueId, venueId),
    inArray(nightlyDevices.id, deviceIds)
  ));
}