"use server";

import { randomUUID } from "node:crypto";

import { and, eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { db } from "@/db";
import {
  activityFeed,
  friendBlocks,
  friendFavorites,
  friendMutes,
  friendRequests,
  friends,
  groupMembers,
  groupMessages,
  meetRequests,
  nightOutSessions,
  presence,
  privacySettings,
  socialGroups,
  socialNotifications,
  socialPreferences,
  socialProfiles,
  users,
} from "@/db/schema";
import { getSocialActor } from "./lib/auth";
import { generateFriendCode, issueFriendQrToken } from "@/lib/social/token";
import type { FriendRequestStatus, GroupVisibility, MeetRequestType, NightOutLocationMode, PresenceStatus, SocialVisibility } from "@/lib/social/types";

function toTrimmedString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toBoolean(value: FormDataEntryValue | null | undefined) {
  return value === "on" || value === "true";
}

function toStringArray(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") return [] as string[];
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function jsonList(values: string[]) {
  return JSON.stringify(values);
}

async function ensureSocialProfile(actor: Awaited<ReturnType<typeof getSocialActor>>) {
  const existing = await db.query.socialProfiles.findFirst({ where: eq(socialProfiles.userId, actor.userId) });
  if (existing) {
    return existing;
  }

  const friendCode = generateFriendCode();
  const friendQrToken = issueFriendQrToken(friendCode);
  const [profile] = await db.insert(socialProfiles).values({
    userId: actor.userId,
    clerkUserId: actor.clerkUserId,
    displayName: `Nightly friend ${actor.userId}`,
    handle: `@nightly-${actor.userId}`,
    avatarUrl: null,
    bio: null,
    interestsJson: jsonList([]),
    favoriteGenresJson: jsonList([]),
    favoriteVenuesJson: jsonList([]),
    favoriteDjsJson: jsonList([]),
    favoriteNeighborhoodsJson: jsonList([]),
    nightlifePersonality: null,
    visibility: "friends",
    socialBadgesJson: jsonList([]),
    activityStatsJson: JSON.stringify({ friendCount: 0, groupCount: 0, nightsOutCount: 0, feedEventsCount: 0 }),
    sharedFriendsCount: 0,
    friendCode,
    friendQrToken,
    isDiscoverable: true,
    isNightOutVisible: true,
  }).returning();

  await db.insert(socialPreferences).values({ userId: actor.userId });
  await db.insert(privacySettings).values({ userId: actor.userId });
  await db.insert(presence).values({ userId: actor.userId, status: "offline", visibility: "friends" });
  return profile;
}

async function writeSocialAudit(actorClerkUserId: string, actorRole: string, entityType: string, entityId: number | string, action: string, metadata?: Record<string, unknown>) {
  await writeAuditLog({
    actorClerkUserId,
    actorRole,
    entityType,
    entityId,
    action,
    metadata,
  });
}

async function refreshActivityStats(userId: number) {
  const [friendCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(friends).where(and(eq(friends.userId, userId), eq(friends.status, "active")));
  const [groupCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(groupMembers).where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")));
  const [nightCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(nightOutSessions).where(eq(nightOutSessions.userId, userId));
  const [feedCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(activityFeed).where(eq(activityFeed.actorUserId, userId));

  await db
    .update(socialProfiles)
    .set({
      sharedFriendsCount: friendCountRow?.count ?? 0,
      activityStatsJson: JSON.stringify({
        friendCount: friendCountRow?.count ?? 0,
        groupCount: groupCountRow?.count ?? 0,
        nightsOutCount: nightCountRow?.count ?? 0,
        feedEventsCount: feedCountRow?.count ?? 0,
      }),
      updatedAt: new Date(),
    })
    .where(eq(socialProfiles.userId, userId));
}

export async function updateSocialProfileAction(formData: FormData) {
  const actor = await getSocialActor();
  const profile = await ensureSocialProfile(actor);
  const displayName = toTrimmedString(formData.get("displayName")) || profile.displayName;
  const handle = toTrimmedString(formData.get("handle")) || profile.handle;
  const bio = toTrimmedString(formData.get("bio")) || null;
  const nightlifePersonality = toTrimmedString(formData.get("nightlifePersonality")) || null;
  const visibility = (toTrimmedString(formData.get("visibility")) as SocialVisibility) || profile.visibility;
  const interests = toStringArray(formData.get("interests"));
  const favoriteGenres = toStringArray(formData.get("favoriteGenres"));
  const favoriteVenues = toStringArray(formData.get("favoriteVenues"));
  const favoriteDjs = toStringArray(formData.get("favoriteDjs"));
  const favoriteNeighborhoods = toStringArray(formData.get("favoriteNeighborhoods"));

  await db
    .update(socialProfiles)
    .set({
      displayName,
      handle,
      bio,
      nightlifePersonality,
      visibility,
      interestsJson: jsonList(interests),
      favoriteGenresJson: jsonList(favoriteGenres),
      favoriteVenuesJson: jsonList(favoriteVenues),
      favoriteDjsJson: jsonList(favoriteDjs),
      favoriteNeighborhoodsJson: jsonList(favoriteNeighborhoods),
      updatedAt: new Date(),
    })
    .where(eq(socialProfiles.userId, actor.userId));

  await refreshActivityStats(actor.userId);
  await writeSocialAudit(actor.clerkUserId, actor.role, "social_profile", actor.userId, "social_profile_updated", { displayName, handle });
  redirect("/crews?profileUpdated=1");
}

export async function updatePrivacySettingsAction(formData: FormData) {
  const actor = await getSocialActor();
  await ensureSocialProfile(actor);
  const profileVisibility = (toTrimmedString(formData.get("profileVisibility")) as SocialVisibility) || "friends";
  const presenceVisibility = (toTrimmedString(formData.get("presenceVisibility")) as SocialVisibility) || "friends";
  const activityVisibility = (toTrimmedString(formData.get("activityVisibility")) as SocialVisibility) || "friends";
  const locationVisibility = (toTrimmedString(formData.get("locationVisibility")) as SocialVisibility) || "close_friends";

  await db.update(privacySettings).set({
    profileVisibility,
    presenceVisibility,
    activityVisibility,
    locationVisibility,
    allowMutualFriends: toBoolean(formData.get("allowMutualFriends")),
    allowSearchIndexing: toBoolean(formData.get("allowSearchIndexing")),
    allowFriendRequests: toBoolean(formData.get("allowFriendRequests")),
    showSharedFriends: toBoolean(formData.get("showSharedFriends")),
    showSocialBadges: toBoolean(formData.get("showSocialBadges")),
    exactLocationShareAllowed: toBoolean(formData.get("exactLocationShareAllowed")),
    updatedAt: new Date(),
  }).where(eq(privacySettings.userId, actor.userId));

  await writeSocialAudit(actor.clerkUserId, actor.role, "privacy_settings", actor.userId, "privacy_settings_updated", { profileVisibility, presenceVisibility, activityVisibility, locationVisibility });
  redirect("/crews?privacyUpdated=1");
}

export async function sendFriendRequestAction(formData: FormData) {
  const actor = await getSocialActor();
  await ensureSocialProfile(actor);
  const recipientUserId = Number(formData.get("recipientUserId"));
  if (!Number.isFinite(recipientUserId) || recipientUserId === actor.userId) {
    throw new Error("Invalid friend request recipient.");
  }

  const [recipient] = await db.select({ id: users.id, clerkUserId: users.clerkUserId }).from(users).where(eq(users.id, recipientUserId)).limit(1);
  if (!recipient) {
    throw new Error("Recipient not found.");
  }

  const existingBlock = await db.query.friendBlocks.findFirst({ where: and(eq(friendBlocks.blockerUserId, recipientUserId), eq(friendBlocks.blockedUserId, actor.userId)) });
  if (existingBlock) {
    throw new Error("This user is not accepting requests.");
  }

  const [request] = await db.insert(friendRequests).values({
    requesterUserId: actor.userId,
    requesterClerkUserId: actor.clerkUserId,
    recipientUserId,
    recipientClerkUserId: recipient.clerkUserId,
    message: toTrimmedString(formData.get("message")) || null,
    inviteCode: toTrimmedString(formData.get("inviteCode")) || null,
    source: "search",
  }).returning();

  await db.insert(socialNotifications).values({
    recipientUserId,
    recipientClerkUserId: recipient.clerkUserId,
    notificationType: "friend_request",
    payloadJson: JSON.stringify({ requestId: request.id, senderUserId: actor.userId }),
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "friend_request", request.id, "friend_request_sent", { recipientUserId });
  redirect("/crews?requestSent=1");
}

export async function respondFriendRequestAction(formData: FormData) {
  const actor = await getSocialActor();
  const requestId = Number(formData.get("requestId"));
  const decision = toTrimmedString(formData.get("decision")) as FriendRequestStatus;

  const request = await db.query.friendRequests.findFirst({ where: eq(friendRequests.id, requestId) });
  if (!request || request.recipientUserId !== actor.userId) {
    throw new Error("Friend request not found.");
  }

  if (decision === "accepted") {
    await db.transaction(async (tx) => {
      await tx.update(friendRequests).set({ status: "accepted", respondedAt: new Date(), updatedAt: new Date() }).where(eq(friendRequests.id, requestId));
      await tx.insert(friends).values([
        { userId: request.requesterUserId, friendUserId: request.recipientUserId, status: "active", sourceRequestId: request.id },
        { userId: request.recipientUserId, friendUserId: request.requesterUserId, status: "active", sourceRequestId: request.id },
      ]);
      await tx.insert(activityFeed).values({
        actorUserId: actor.userId,
        actorClerkUserId: actor.clerkUserId,
        activityType: "created_group",
        visibility: "friends",
        payloadJson: JSON.stringify({ type: "friend_accepted", requestId }),
      }).catch(() => null);
    });
  } else {
    await db.update(friendRequests).set({ status: "declined", respondedAt: new Date(), updatedAt: new Date(), declinedReason: toTrimmedString(formData.get("reason")) || null }).where(eq(friendRequests.id, requestId));
  }

  await writeSocialAudit(actor.clerkUserId, actor.role, "friend_request", request.id, `friend_request_${decision}`, { requestId });
  redirect("/crews?requestUpdated=1");
}

export async function toggleFriendFavoriteAction(formData: FormData) {
  const actor = await getSocialActor();
  const friendUserId = Number(formData.get("friendUserId"));
  if (!Number.isFinite(friendUserId)) throw new Error("Invalid friend.");

  const isCloseFriend = toBoolean(formData.get("isCloseFriend"));
  await db.insert(friendFavorites).values({
    userId: actor.userId,
    friendUserId,
    isCloseFriend,
    note: toTrimmedString(formData.get("note")) || null,
  }).onConflictDoUpdate({ target: [friendFavorites.userId, friendFavorites.friendUserId], set: { isCloseFriend, note: toTrimmedString(formData.get("note")) || null, updatedAt: new Date() } });

  await refreshActivityStats(actor.userId);
  await writeSocialAudit(actor.clerkUserId, actor.role, "friend_favorite", friendUserId, "friend_favorite_updated", { isCloseFriend });
  redirect("/crews?favoriteUpdated=1");
}

export async function toggleFriendMuteAction(formData: FormData) {
  const actor = await getSocialActor();
  const friendUserId = Number(formData.get("friendUserId"));
  if (!Number.isFinite(friendUserId)) throw new Error("Invalid friend.");

  const mutedUntilRaw = toTrimmedString(formData.get("mutedUntil"));
  const mutedUntil = mutedUntilRaw ? new Date(mutedUntilRaw) : null;
  await db.insert(friendMutes).values({
    userId: actor.userId,
    friendUserId,
    mutedUntil,
    reason: toTrimmedString(formData.get("reason")) || null,
  }).onConflictDoUpdate({ target: [friendMutes.userId, friendMutes.friendUserId], set: { mutedUntil, reason: toTrimmedString(formData.get("reason")) || null, updatedAt: new Date() } });

  await writeSocialAudit(actor.clerkUserId, actor.role, "friend_mute", friendUserId, "friend_muted", { mutedUntil });
  redirect("/crews?muteUpdated=1");
}

export async function blockUserAction(formData: FormData) {
  const actor = await getSocialActor();
  const blockedUserId = Number(formData.get("blockedUserId"));
  if (!Number.isFinite(blockedUserId)) throw new Error("Invalid user.");

  await db.insert(friendBlocks).values({
    blockerUserId: actor.userId,
    blockedUserId,
    reason: toTrimmedString(formData.get("reason")) || null,
  }).onConflictDoNothing();

  await db.update(friendRequests).set({ status: "blocked", updatedAt: new Date() }).where(or(and(eq(friendRequests.requesterUserId, actor.userId), eq(friendRequests.recipientUserId, blockedUserId)), and(eq(friendRequests.recipientUserId, actor.userId), eq(friendRequests.requesterUserId, blockedUserId))));
  await db.update(friends).set({ status: "removed", updatedAt: new Date() }).where(or(and(eq(friends.userId, actor.userId), eq(friends.friendUserId, blockedUserId)), and(eq(friends.userId, blockedUserId), eq(friends.friendUserId, actor.userId))));

  await writeSocialAudit(actor.clerkUserId, actor.role, "friend_block", blockedUserId, "user_blocked");
  redirect("/crews?blocked=1");
}

export async function createSocialGroupAction(formData: FormData) {
  const actor = await getSocialActor();
  const name = toTrimmedString(formData.get("name"));
  if (!name) throw new Error("Group name is required.");

  const inviteCode = `GRP-${randomUUID().slice(0, 8).toUpperCase()}`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || `group-${actor.userId}`;
  const [group] = await db.insert(socialGroups).values({
    slug: `${slug}-${randomUUID().slice(0, 4).toLowerCase()}`,
    name,
    description: toTrimmedString(formData.get("description")) || null,
    imageUrl: toTrimmedString(formData.get("imageUrl")) || null,
    hostUserId: actor.userId,
    hostClerkUserId: actor.clerkUserId,
    capacity: Math.max(Number(formData.get("capacity")) || 8, 2),
    visibility: (toTrimmedString(formData.get("visibility")) as GroupVisibility) || "private",
    isTemporary: toBoolean(formData.get("isTemporary")),
    isRecurring: toBoolean(formData.get("isRecurring")),
    inviteCode,
    venueId: Number(formData.get("venueId")) || null,
    eventId: Number(formData.get("eventId")) || null,
    timezone: toTrimmedString(formData.get("timezone")) || null,
    startsAt: toTrimmedString(formData.get("startsAt")) ? new Date(toTrimmedString(formData.get("startsAt"))) : null,
    endsAt: toTrimmedString(formData.get("endsAt")) ? new Date(toTrimmedString(formData.get("endsAt"))) : null,
    expiresAt: toTrimmedString(formData.get("expiresAt")) ? new Date(toTrimmedString(formData.get("expiresAt"))) : null,
  }).returning();

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: actor.userId,
    clerkUserId: actor.clerkUserId,
    role: "host",
    status: "active",
    joinedAt: new Date(),
  });

  await db.insert(activityFeed).values({
    actorUserId: actor.userId,
    actorClerkUserId: actor.clerkUserId,
    activityType: "created_group",
    visibility: "friends",
    payloadJson: JSON.stringify({ groupId: group.id, name: group.name }),
    groupId: group.id,
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "social_group", group.id, "group_created", { name });
  redirect(`/crews/${group.slug}`);
}

export async function startNightOutAction(formData: FormData) {
  const actor = await getSocialActor();
  const locationMode = (toTrimmedString(formData.get("locationMode")) as NightOutLocationMode) || "approximate";
  const [session] = await db.insert(nightOutSessions).values({
    userId: actor.userId,
    groupId: Number(formData.get("groupId")) || null,
    venueId: Number(formData.get("venueId")) || null,
    status: "active",
    locationMode,
    venueOnlyShare: toBoolean(formData.get("venueOnlyShare")),
    timeLimitedShare: toBoolean(formData.get("timeLimitedShare")) || false,
    approximateLocationLabel: toTrimmedString(formData.get("approximateLocationLabel")) || null,
    exactLocationJson: toTrimmedString(formData.get("exactLocationJson")) || null,
    currentStopLabel: toTrimmedString(formData.get("currentStopLabel")) || null,
    nextStopLabel: toTrimmedString(formData.get("nextStopLabel")) || null,
    expiresAt: toTrimmedString(formData.get("expiresAt")) ? new Date(toTrimmedString(formData.get("expiresAt"))) : null,
  }).returning();

  await db.insert(presence).values({ userId: actor.userId, nightOutSessionId: session.id, status: toTrimmedString(formData.get("status")) as PresenceStatus || "heading_out", visibility: (toTrimmedString(formData.get("visibility")) as SocialVisibility) || "friends", venueId: Number(formData.get("venueId")) || null, approximateLocationLabel: toTrimmedString(formData.get("approximateLocationLabel")) || null, exactLocationJson: toTrimmedString(formData.get("exactLocationJson")) || null, lastSeenAt: new Date() }).onConflictDoUpdate({ target: presence.userId, set: { nightOutSessionId: session.id, status: toTrimmedString(formData.get("status")) as PresenceStatus || "heading_out", visibility: (toTrimmedString(formData.get("visibility")) as SocialVisibility) || "friends", venueId: Number(formData.get("venueId")) || null, approximateLocationLabel: toTrimmedString(formData.get("approximateLocationLabel")) || null, exactLocationJson: toTrimmedString(formData.get("exactLocationJson")) || null, lastSeenAt: new Date(), updatedAt: new Date() } });

  await db.insert(activityFeed).values({
    actorUserId: actor.userId,
    actorClerkUserId: actor.clerkUserId,
    activityType: "started_night_out",
    visibility: "friends",
    payloadJson: JSON.stringify({ nightOutSessionId: session.id, locationMode }),
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "night_out_session", session.id, "night_out_started", { locationMode });
  redirect("/crews?nightOutStarted=1");
}

export async function endNightOutAction(formData: FormData) {
  const actor = await getSocialActor();
  const nightOutSessionId = Number(formData.get("nightOutSessionId"));
  await db.update(nightOutSessions).set({ status: "ended", endsAt: new Date(), updatedAt: new Date() }).where(eq(nightOutSessions.id, nightOutSessionId));
  await db.update(presence).set({ status: "night_over", updatedAt: new Date() }).where(eq(presence.userId, actor.userId));
  await writeSocialAudit(actor.clerkUserId, actor.role, "night_out_session", nightOutSessionId, "night_out_ended");
  redirect("/crews?nightOutEnded=1");
}

export async function createGroupMessageAction(formData: FormData) {
  const actor = await getSocialActor();
  const groupId = Number(formData.get("groupId"));
  const body = toTrimmedString(formData.get("body"));
  if (!body) throw new Error("Message body is required.");

  await db.insert(groupMessages).values({
    groupId,
    senderUserId: actor.userId,
    senderClerkUserId: actor.clerkUserId,
    messageType: (toTrimmedString(formData.get("messageType")) as never) || "text",
    body,
    mediaUrl: toTrimmedString(formData.get("mediaUrl")) || null,
    replyToMessageId: Number(formData.get("replyToMessageId")) || null,
    mentionsJson: jsonList(toStringArray(formData.get("mentions"))),
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "social_group", groupId, "group_message_sent");
  redirect(`/crews/${formData.get("groupSlug")}`);
}

export async function createMeetRequestAction(formData: FormData) {
  const actor = await getSocialActor();
  const requestType = (toTrimmedString(formData.get("requestType")) as MeetRequestType) || "meet_here";
  await db.insert(meetRequests).values({
    requesterUserId: actor.userId,
    requesterClerkUserId: actor.clerkUserId,
    recipientUserId: Number(formData.get("recipientUserId")) || null,
    recipientClerkUserId: toTrimmedString(formData.get("recipientClerkUserId")) || null,
    groupId: Number(formData.get("groupId")) || null,
    nightOutSessionId: Number(formData.get("nightOutSessionId")) || null,
    venueId: Number(formData.get("venueId")) || null,
    requestType,
    status: "pending",
    message: toTrimmedString(formData.get("message")) || null,
    etaMinutes: Number(formData.get("etaMinutes")) || null,
    venueLabel: toTrimmedString(formData.get("venueLabel")) || null,
    locationJson: toTrimmedString(formData.get("locationJson")) || null,
    expiresAt: toTrimmedString(formData.get("expiresAt")) ? new Date(toTrimmedString(formData.get("expiresAt"))) : null,
  });
  await writeSocialAudit(actor.clerkUserId, actor.role, "meet_request", actor.userId, "meet_request_created", { requestType });
  redirect("/crews?meetRequest=1");
}
