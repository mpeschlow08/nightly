import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  artistPerformanceSessions, artistSessionHistory, artistSessionMedia, artistSessionSources,
  djProfiles, events, nightlyDevices, nightlyDeviceSources, users, venueCameras, venues,
} from "@/db/schema";
import { projectDeviceMediaBindings } from "@/lib/nightly-device/media-bindings";
import { canUseDeviceForOperationalManagement, canUseDeviceForService } from "@/lib/nightly-device/policy";
import { ARTIST_SESSION_MAX_DURATION_MS, mayAccessArtistSession, sourceRole, type SessionActor } from "./policy";

type SessionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function expireStaleSessions(tx: SessionTransaction, now: Date, scope: { djProfileId?: number; venueId?: number }) {
  const conditions = [eq(artistPerformanceSessions.status, "active"),
    isNull(artistPerformanceSessions.endedAt),
    lt(artistPerformanceSessions.startedAt, new Date(now.getTime() - ARTIST_SESSION_MAX_DURATION_MS))];
  if (scope.djProfileId !== undefined) conditions.push(eq(artistPerformanceSessions.djProfileId, scope.djProfileId));
  if (scope.venueId !== undefined) conditions.push(eq(artistPerformanceSessions.venueId, scope.venueId));
  const expired = await tx.update(artistPerformanceSessions).set({ status: "ended", endedAt: now, updatedAt: now,
    mediaRevision: sql`${artistPerformanceSessions.mediaRevision} + 1` })
    .where(and(...conditions)).returning({ id: artistPerformanceSessions.id });
  if (expired.length) await tx.insert(artistSessionHistory).values(expired.map(({ id }) => ({ sessionId: id, action: "expired" })));
  return expired.length;
}

async function assertDj(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: SessionActor) {
  const [owner] = await tx.select({ id: users.id, role: users.role, enabled: users.isOnboarded,
    accountStatus: users.accountStatus, disabledAt: users.disabledAt, profileId: djProfiles.id })
    .from(users).innerJoin(djProfiles, eq(djProfiles.userId, users.id))
    .where(and(eq(users.id, actor.userId), eq(djProfiles.id, actor.djProfileId))).limit(1);
  if (!owner || owner.role !== "dj" || !owner.enabled || owner.accountStatus !== "active" || owner.disabledAt !== null)
    throw new Error("artist_session_forbidden");
}

async function assertVenue(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], venueId: number, eventId: number | null) {
  if (!Number.isSafeInteger(venueId) || venueId <= 0) throw new Error("artist_session_venue_invalid");
  const [venue] = await tx.select({ id: venues.id, name: venues.name }).from(venues).where(eq(venues.id, venueId)).limit(1);
  if (!venue) throw new Error("artist_session_venue_invalid");
  if (eventId !== null) {
    if (!Number.isSafeInteger(eventId) || eventId <= 0 || !(await tx.select({ id: events.id }).from(events)
      .where(and(eq(events.id, eventId), eq(events.venueId, venueId))).limit(1)).length) throw new Error("artist_session_event_invalid");
  }
  return venue;
}

export async function listSessionVenues() {
  const rows = await db.select({ id: venues.id, name: venues.name, city: venues.city, heroImageUrl: venues.heroImageUrl })
    .from(venues).innerJoin(nightlyDevices, eq(nightlyDevices.venueId, venues.id))
    .where(and(eq(nightlyDevices.serviceEntitlementState, "active"), inArray(nightlyDevices.lifecycleState, ["active", "degraded"]),
      eq(nightlyDevices.claimState, "claimed"), eq(nightlyDevices.hotReelEligible, true), eq(nightlyDevices.contentEligibility, "approved"),
      eq(nightlyDevices.publicPublishingEnabled, true), sql`${nightlyDevices.serviceSuspendedAt} is null`))
    .groupBy(venues.id).orderBy(venues.name).limit(40);
  return rows;
}

export async function getArtistSessions(actor: SessionActor) {
  return db.transaction(async (tx) => {
    await assertDj(tx, actor);
    await expireStaleSessions(tx, new Date(), { djProfileId: actor.djProfileId });
    return tx.select({ id: artistPerformanceSessions.id, publicId: artistPerformanceSessions.publicId, venueId: artistPerformanceSessions.venueId,
      venueName: venues.name, status: artistPerformanceSessions.status, startedAt: artistPerformanceSessions.startedAt,
      endedAt: artistPerformanceSessions.endedAt, includeMicrophone: artistPerformanceSessions.includeMicrophone })
      .from(artistPerformanceSessions).innerJoin(venues, eq(venues.id, artistPerformanceSessions.venueId))
      .where(and(eq(artistPerformanceSessions.userId, actor.userId), eq(artistPerformanceSessions.djProfileId, actor.djProfileId)))
      .orderBy(desc(artistPerformanceSessions.createdAt)).limit(20);
  });
}

export async function expireStaleVenueSessions(venueId: number, now = new Date()) {
  if (!Number.isSafeInteger(venueId) || venueId <= 0) return 0;
  return db.transaction((tx) => expireStaleSessions(tx, now, { venueId }));
}

export async function prepareSession(actor: SessionActor, venueId: number, eventId: number | null = null) {
  return db.transaction(async (tx) => {
    await assertDj(tx, actor);
    await assertVenue(tx, venueId, eventId);
    await expireStaleSessions(tx, new Date(), { djProfileId: actor.djProfileId });
    const [active] = await tx.select().from(artistPerformanceSessions)
      .where(and(eq(artistPerformanceSessions.djProfileId, actor.djProfileId), eq(artistPerformanceSessions.status, "active"))).limit(1);
    if (active) return active;
    const [prepared] = await tx.select().from(artistPerformanceSessions).where(and(eq(artistPerformanceSessions.djProfileId, actor.djProfileId),
      eq(artistPerformanceSessions.venueId, venueId), eq(artistPerformanceSessions.status, "ready"))).orderBy(desc(artistPerformanceSessions.createdAt)).limit(1);
    if (prepared) return prepared;
    const [session] = await tx.insert(artistPerformanceSessions).values({ publicId: randomUUID(), userId: actor.userId,
      djProfileId: actor.djProfileId, venueId, eventId }).returning();
    await tx.insert(artistSessionHistory).values({ sessionId: session.id, actorUserId: actor.userId, action: "checked_in" });
    return session;
  });
}

export async function startSession(actor: SessionActor, publicId: string) {
  if (!/^[0-9a-f-]{36}$/.test(publicId)) throw new Error("artist_session_invalid");
  return db.transaction(async (tx) => {
    await assertDj(tx, actor);
    await expireStaleSessions(tx, new Date(), { djProfileId: actor.djProfileId });
    const [session] = await tx.select().from(artistPerformanceSessions).where(eq(artistPerformanceSessions.publicId, publicId)).for("update").limit(1);
    if (!session || !mayAccessArtistSession(actor, session)) throw new Error("artist_session_forbidden");
    if (session.status === "active") return session;
    if (session.status !== "ready") throw new Error("artist_session_not_ready");
    const [other] = await tx.select({ id: artistPerformanceSessions.id }).from(artistPerformanceSessions)
      .where(and(eq(artistPerformanceSessions.djProfileId, actor.djProfileId), eq(artistPerformanceSessions.status, "active"))).limit(1);
    if (other) throw new Error("artist_session_already_active");
    await assertVenue(tx, session.venueId, session.eventId);
    const devices = await tx.select().from(nightlyDevices).where(eq(nightlyDevices.venueId, session.venueId));
    const eligible = devices.filter((device) => canUseDeviceForService(device) && canUseDeviceForOperationalManagement(device) &&
      device.contentEligibility === "approved" && device.hotReelEligible && device.publicPublishingEnabled && device.desiredConfigRevision);
    if (!eligible.length) throw new Error("artist_session_media_unavailable");
    const sources = await tx.select({ id: nightlyDeviceSources.id, deviceId: nightlyDeviceSources.deviceId,
      venueId: nightlyDeviceSources.venueId, sourceType: nightlyDeviceSources.sourceType, sourceLabel: nightlyDeviceSources.sourceLabel,
      venueCameraId: nightlyDeviceSources.venueCameraId, enabled: nightlyDeviceSources.enabled, cameraVenueId: venueCameras.venueId,
      cameraStatus: venueCameras.status, cameraStreamType: venueCameras.streamType })
      .from(nightlyDeviceSources).leftJoin(venueCameras, eq(venueCameras.id, nightlyDeviceSources.venueCameraId))
      .where(eq(nightlyDeviceSources.venueId, session.venueId));
    const eligibleIds = new Set(eligible.map((device) => device.id));
    const associated = sources.filter((source) => eligibleIds.has(source.deviceId) &&
      projectDeviceMediaBindings([source], source.deviceId, session.venueId).length && sourceRole(source.sourceType));
    if (!associated.length) throw new Error("artist_session_media_unavailable");
    const now = new Date();
    await tx.insert(artistSessionSources).values(associated.map((source) => ({ sessionId: session.id, sourceId: source.id,
      deviceId: source.deviceId, sourceKey: source.id, deviceKey: source.deviceId, sourceType: source.sourceType,
      role: sourceRole(source.sourceType)!, label: "Session source",
      configRevision: eligible.find((device) => device.id === source.deviceId)!.desiredConfigRevision! })));
    const [started] = await tx.update(artistPerformanceSessions).set({ status: "active", startedAt: now, updatedAt: now })
      .where(eq(artistPerformanceSessions.id, session.id)).returning();
    await tx.insert(artistSessionHistory).values({ sessionId: session.id, actorUserId: actor.userId, action: "started" });
    return started;
  });
}

export async function endSession(actor: SessionActor, publicId: string) {
  return db.transaction(async (tx) => {
    await assertDj(tx, actor);
    await expireStaleSessions(tx, new Date(), { djProfileId: actor.djProfileId });
    const [session] = await tx.select().from(artistPerformanceSessions).where(eq(artistPerformanceSessions.publicId, publicId)).for("update").limit(1);
    if (!session || !mayAccessArtistSession(actor, session)) throw new Error("artist_session_forbidden");
    if (session.status === "ended") return session;
    if (session.status !== "active") throw new Error("artist_session_not_active");
    const now = new Date();
    const [ended] = await tx.update(artistPerformanceSessions).set({ status: "ended", endedAt: now, updatedAt: now,
      mediaRevision: session.mediaRevision + 1 }).where(eq(artistPerformanceSessions.id, session.id)).returning();
    await tx.insert(artistSessionHistory).values({ sessionId: session.id, actorUserId: actor.userId, action: "ended" });
    return ended;
  });
}

export async function updateSessionMicrophone(actor: SessionActor, publicId: string, includeMicrophone: boolean) {
  if (typeof includeMicrophone !== "boolean") throw new Error("artist_session_invalid");
  return db.transaction(async (tx) => {
    await assertDj(tx, actor);
    const [session] = await tx.select().from(artistPerformanceSessions).where(eq(artistPerformanceSessions.publicId, publicId)).for("update").limit(1);
    if (!session || !mayAccessArtistSession(actor, session) || session.status !== "active") throw new Error("artist_session_forbidden");
    if (session.includeMicrophone === includeMicrophone) return session;
    const [updated] = await tx.update(artistPerformanceSessions).set({ includeMicrophone, mediaRevision: session.mediaRevision + 1,
      updatedAt: new Date() }).where(eq(artistPerformanceSessions.id, session.id)).returning();
    await tx.insert(artistSessionHistory).values({ sessionId: session.id, actorUserId: actor.userId, action: "microphone_preference_updated" });
    return updated;
  });
}

export async function getSessionSources(actor: SessionActor, sessionId: number) {
  const [session] = await db.select().from(artistPerformanceSessions).where(eq(artistPerformanceSessions.id, sessionId)).limit(1);
  if (!session || !mayAccessArtistSession(actor, session)) throw new Error("artist_session_forbidden");
  return db.select({ role: artistSessionSources.role, label: artistSessionSources.label }).from(artistSessionSources)
    .where(eq(artistSessionSources.sessionId, session.id));
}

export async function getSessionMedia(actor: SessionActor, sessionId: number) {
  const [session] = await db.select().from(artistPerformanceSessions).where(eq(artistPerformanceSessions.id, sessionId)).limit(1);
  if (!session || !mayAccessArtistSession(actor, session)) throw new Error("artist_session_forbidden");
  return db.select({ id: artistSessionMedia.id, reviewState: artistSessionMedia.reviewState,
    start: artistSessionMedia.windowStartAt, end: artistSessionMedia.windowEndAt })
    .from(artistSessionMedia).where(eq(artistSessionMedia.sessionId, session.id)).orderBy(desc(artistSessionMedia.createdAt)).limit(40);
}

export async function updateSessionMediaReview(actor: SessionActor, publicId: string, mediaId: number, reviewState: "approved" | "hidden") {
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0 || !["approved", "hidden"].includes(reviewState))
    throw new Error("artist_session_media_invalid");
  return db.transaction(async (tx) => {
    await assertDj(tx, actor);
    const [session] = await tx.select().from(artistPerformanceSessions)
      .where(eq(artistPerformanceSessions.publicId, publicId)).for("update").limit(1);
    if (!session || !mayAccessArtistSession(actor, session) || !["active", "ended"].includes(session.status))
      throw new Error("artist_session_forbidden");
    const [media] = await tx.select().from(artistSessionMedia).where(and(
      eq(artistSessionMedia.id, mediaId), eq(artistSessionMedia.sessionId, session.id))).for("update").limit(1);
    if (!media || media.reviewState === "pending") throw new Error("artist_session_media_unavailable");
    if (media.reviewState === reviewState) return { id: media.id, reviewState: media.reviewState };
    const [updated] = await tx.update(artistSessionMedia).set({ reviewState, updatedAt: new Date() })
      .where(eq(artistSessionMedia.id, media.id)).returning({ id: artistSessionMedia.id, reviewState: artistSessionMedia.reviewState });
    await tx.insert(artistSessionHistory).values({ sessionId: session.id, actorUserId: actor.userId,
      action: reviewState === "approved" ? "media_approved" : "media_hidden" });
    return updated;
  });
}