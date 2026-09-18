import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { venueCameras, venues } from "@/db/schema";
import { getLiveStreamProvider } from "@/lib/live/provider";
import { logger } from "@/lib/platform/logger";
import {
  authorizeLivePlaybackCore,
  type LivePlaybackAuthorizationResult,
} from "@/lib/live/playback-core";
import { type LivePlaybackActor } from "@/lib/live/entitlement";

export async function authorizeLivePlayback(input: {
  venueSlugOrId: string;
  cameraId?: number | null;
  actor: LivePlaybackActor;
}): Promise<LivePlaybackAuthorizationResult> {
  const [venue] = await db
    .select({ id: venues.id, slug: venues.slug, name: venues.name, publicationStatus: venues.publicationStatus, city: venues.city })
    .from(venues)
    .where(
      or(
        eq(venues.slug, input.venueSlugOrId),
        Number.isInteger(Number(input.venueSlugOrId)) ? eq(venues.id, Number(input.venueSlugOrId)) : eq(venues.id, -1)
      )
    )
    .limit(1);

  if (!venue || venue.publicationStatus !== "published") {
    return {
      status: "denied",
      reason: "venue_not_available",
      state: "offline",
      venue: null,
      camera: null,
      playback: null,
    };
  }

  const cameras = await db
    .select()
    .from(venueCameras)
    .where(and(eq(venueCameras.venueId, venue.id), eq(venueCameras.status, "enabled")))
    .orderBy(desc(venueCameras.isPrimary), asc(venueCameras.id));

  const provider = getLiveStreamProvider();
  return authorizeLivePlaybackCore({
    venue,
    cameras,
    cameraId: input.cameraId,
    actor: input.actor,
    provider,
    logger,
    onCameraHealthObserved: async (cameraId, providerStatus) => {
      await db
        .update(venueCameras)
        .set({
          lastKnownStreamStatus: providerStatus,
          lastHealthCheckAt: new Date(),
        })
        .where(eq(venueCameras.id, cameraId));
    },
  });
}
