import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  activityFeed,
  directConversations,
  directMessages,
  friendBlocks,
  friendFavorites,
  friendMutes,
  friendRequests,
  friends,
  groupMembers,
  groupMessages,
  meetRequests,
  nightOutPlans,
  nightOutSessions,
  presence,
  privacySettings,
  socialGroups,
  socialMessageReceipts,
  socialNotifications,
  socialPreferences,
  socialProfiles,
  socialReports,
  users,
  venues,
  events,
} from "@/db/schema";
import { getUserRole } from "@/app/lib/user-roles";
import { currentUser } from "@clerk/nextjs/server";
import { generateFriendCode, issueFriendQrToken } from "./token";
import type { SocialAccessActor } from "./permissions";
import { socialActivityLabel } from "./feed";

function parseList(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function stringifyList(value: string[]) {
  return JSON.stringify(value);
}

function stringifyStats(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

async function resolveCurrentActor(): Promise<SocialAccessActor> {
  const viewer = await currentUser();
  const userId = viewer?.id;
  if (!userId) {
    throw new Error("Sign in required");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { id: true, clerkUserId: true, role: true },
  });

  if (!user) {
    throw new Error("User profile not found");
  }

  const role = (await getUserRole(user.clerkUserId)) ?? user.role;

  return {
    userId: user.id,
    clerkUserId: user.clerkUserId,
    role,
  };
}

async function ensureProfileRows(actor: SocialAccessActor) {
  const viewer = await currentUser();
  const displayName = viewer?.fullName?.trim() || viewer?.username || viewer?.firstName || "Nightly friend";
  const handle = viewer?.username ? `@${viewer.username}` : `@friend-${actor.userId}`;
  const avatarUrl = viewer?.imageUrl ?? null;

  const profile = await db.query.socialProfiles.findFirst({ where: eq(socialProfiles.userId, actor.userId) });
  if (!profile) {
    const friendCode = generateFriendCode();
    const friendQrToken = issueFriendQrToken(friendCode);
    const [created] = await db.insert(socialProfiles).values({
      userId: actor.userId,
      clerkUserId: actor.clerkUserId,
      displayName,
      handle,
      avatarUrl,
      bio: null,
      interestsJson: stringifyList([]),
      favoriteGenresJson: stringifyList([]),
      favoriteVenuesJson: stringifyList([]),
      favoriteDjsJson: stringifyList([]),
      favoriteNeighborhoodsJson: stringifyList([]),
      nightlifePersonality: null,
      visibility: "friends",
      socialBadgesJson: stringifyList([]),
      activityStatsJson: stringifyStats({ friendCount: 0, groupCount: 0, nightsOutCount: 0, feedEventsCount: 0 }),
      sharedFriendsCount: 0,
      friendCode,
      friendQrToken,
      isDiscoverable: true,
      isNightOutVisible: true,
    }).returning();

    await db.insert(socialPreferences).values({ userId: actor.userId });
    await db.insert(privacySettings).values({ userId: actor.userId });
    await db.insert(presence).values({ userId: actor.userId, status: "offline", visibility: "friends", lastSeenAt: new Date() });
    return created;
  }

  return profile;
}

async function getViewerIds(actor: SocialAccessActor) {
  const blockedByViewer = await db
    .select({ blockedUserId: friendBlocks.blockedUserId })
    .from(friendBlocks)
    .where(eq(friendBlocks.blockerUserId, actor.userId));
  const viewerBlocked = await db
    .select({ blockerUserId: friendBlocks.blockerUserId })
    .from(friendBlocks)
    .where(eq(friendBlocks.blockedUserId, actor.userId));

  return {
    blockedByViewerIds: new Set(blockedByViewer.map((row) => row.blockedUserId)),
    viewerBlockedIds: new Set(viewerBlocked.map((row) => row.blockerUserId)),
  };
}

export async function getDirectConversationOverview(limit = 12) {
  const actor = await resolveCurrentActor();
  await ensureProfileRows(actor);

  const conversations = await db
    .select()
    .from(directConversations)
    .where(or(eq(directConversations.userOneId, actor.userId), eq(directConversations.userTwoId, actor.userId)))
    .orderBy(desc(directConversations.lastMessageAt), desc(directConversations.updatedAt))
    .limit(limit);

  const conversationIds = conversations.map((conversation) => conversation.id);
  const peerIds = conversations.map((conversation) => (conversation.userOneId === actor.userId ? conversation.userTwoId : conversation.userOneId));

  const [profiles, messages] = await Promise.all([
    peerIds.length > 0
      ? db.select({ userId: socialProfiles.userId, displayName: socialProfiles.displayName, handle: socialProfiles.handle, avatarUrl: socialProfiles.avatarUrl }).from(socialProfiles).where(inArray(socialProfiles.userId, peerIds))
      : Promise.resolve([]),
    conversationIds.length > 0
      ? db.select().from(directMessages).where(inArray(directMessages.conversationId, conversationIds)).orderBy(desc(directMessages.createdAt), desc(directMessages.id)).limit(limit * 6)
      : Promise.resolve([]),
  ]);

  const latestByConversation = new Map<number, (typeof messages)[number]>();
  for (const message of messages) {
    if (!latestByConversation.has(message.conversationId)) {
      latestByConversation.set(message.conversationId, message);
    }
  }

  const latestMessageIds = [...latestByConversation.values()].map((message) => message.id);
  const receipts = latestMessageIds.length > 0
    ? await db
        .select({ directMessageId: socialMessageReceipts.directMessageId, status: socialMessageReceipts.status, recipientUserId: socialMessageReceipts.recipientUserId })
        .from(socialMessageReceipts)
        .where(and(inArray(socialMessageReceipts.directMessageId, latestMessageIds), eq(socialMessageReceipts.recipientUserId, actor.userId)))
    : [];

  return conversations.map((conversation) => {
    const peerUserId = conversation.userOneId === actor.userId ? conversation.userTwoId : conversation.userOneId;
    const peer = profiles.find((profile) => profile.userId === peerUserId) ?? null;
    const latestMessage = latestByConversation.get(conversation.id) ?? null;
    const unreadCount = latestMessage
      ? receipts.filter((receipt) => receipt.directMessageId === latestMessage.id && receipt.status !== "read").length
      : 0;

    return {
      ...conversation,
      peer,
      latestMessage,
      unreadCount,
      isArchived: conversation.userOneId === actor.userId ? conversation.archivedByUserOne : conversation.archivedByUserTwo,
      deletedAt: conversation.userOneId === actor.userId ? conversation.deletedByUserOneAt : conversation.deletedByUserTwoAt,
    };
  }).filter((conversation) => !conversation.deletedAt);
}

export async function searchSocialPlatform(query: string) {
  const actor = await resolveCurrentActor();
  await ensureProfileRows(actor);

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      friends: [],
      groups: [],
      messages: [],
      venues: [],
      events: [],
      plans: [],
      tickets: [],
      guestLists: [],
    };
  }

  const likeQuery = `%${normalizedQuery}%`;
  const memberships = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, actor.userId), eq(groupMembers.status, "active")));
  const membershipGroupIds = memberships.map((entry) => entry.groupId);
  const conversations = await db.select({ id: directConversations.id }).from(directConversations).where(or(eq(directConversations.userOneId, actor.userId), eq(directConversations.userTwoId, actor.userId)));
  const conversationIds = conversations.map((entry) => entry.id);

  const [friendsResult, groupsResult, groupMessagesResult, directMessagesResult, venuesResult, eventsResult, plansResult] = await Promise.all([
    db.select({ userId: socialProfiles.userId, displayName: socialProfiles.displayName, handle: socialProfiles.handle, avatarUrl: socialProfiles.avatarUrl, bio: socialProfiles.bio }).from(socialProfiles).where(and(or(ilike(socialProfiles.displayName, likeQuery), ilike(socialProfiles.handle, likeQuery), ilike(socialProfiles.bio, likeQuery)), sql`${socialProfiles.userId} <> ${actor.userId}`)).limit(8),
    db.select({ id: socialGroups.id, slug: socialGroups.slug, name: socialGroups.name, description: socialGroups.description, visibility: socialGroups.visibility }).from(socialGroups).where(or(ilike(socialGroups.name, likeQuery), ilike(socialGroups.description, likeQuery))).limit(8),
    membershipGroupIds.length > 0
      ? db.select({ id: groupMessages.id, groupId: groupMessages.groupId, body: groupMessages.body, createdAt: groupMessages.createdAt }).from(groupMessages).where(and(inArray(groupMessages.groupId, membershipGroupIds), ilike(groupMessages.body, likeQuery))).orderBy(desc(groupMessages.createdAt)).limit(8)
      : Promise.resolve([]),
    conversationIds.length > 0
      ? db.select({ id: directMessages.id, conversationId: directMessages.conversationId, body: directMessages.body, createdAt: directMessages.createdAt }).from(directMessages).where(and(inArray(directMessages.conversationId, conversationIds), ilike(directMessages.body, likeQuery))).orderBy(desc(directMessages.createdAt)).limit(8)
      : Promise.resolve([]),
    db.select({ id: venues.id, slug: venues.slug, name: venues.name, neighborhood: venues.neighborhood }).from(venues).where(or(ilike(venues.name, likeQuery), ilike(venues.neighborhood, likeQuery))).limit(8),
    db.select({ id: events.id, slug: events.slug, title: events.title }).from(events).where(ilike(events.title, likeQuery)).limit(8),
    db.select({ id: nightOutPlans.id, title: nightOutPlans.title, description: nightOutPlans.description, groupId: nightOutPlans.groupId }).from(nightOutPlans).where(or(ilike(nightOutPlans.title, likeQuery), ilike(nightOutPlans.description, likeQuery))).limit(8),
  ]);

  return {
    friends: friendsResult,
    groups: groupsResult.filter((group) => group.visibility === "public" || membershipGroupIds.includes(group.id)),
    messages: [...groupMessagesResult.map((message) => ({ ...message, kind: "group" as const })), ...directMessagesResult.map((message) => ({ ...message, kind: "direct" as const }))],
    venues: venuesResult,
    events: eventsResult,
    plans: plansResult.filter((plan) => !plan.groupId || membershipGroupIds.includes(plan.groupId)),
    tickets: [],
    guestLists: [],
  };
}

export async function getSocialDashboardData() {
  const actor = await resolveCurrentActor();
  const profile = await ensureProfileRows(actor);
  const prefs = await db.query.socialPreferences.findFirst({ where: eq(socialPreferences.userId, actor.userId) });
  const privacy = await db.query.privacySettings.findFirst({ where: eq(privacySettings.userId, actor.userId) });
  const presenceRow = await db.query.presence.findFirst({ where: eq(presence.userId, actor.userId) });

  const [requestRows, friendRows, favoriteRows, muteRows, membershipRows, feedRows, notificationRows, meetRows, reportRows, nightRows] = await Promise.all([
    db.select().from(friendRequests).where(eq(friendRequests.recipientUserId, actor.userId)).orderBy(desc(friendRequests.createdAt)).limit(20),
    db.select().from(friends).where(eq(friends.userId, actor.userId)).orderBy(desc(friends.updatedAt)).limit(50),
    db.select().from(friendFavorites).where(eq(friendFavorites.userId, actor.userId)).orderBy(desc(friendFavorites.updatedAt)).limit(50),
    db.select().from(friendMutes).where(eq(friendMutes.userId, actor.userId)).orderBy(desc(friendMutes.updatedAt)).limit(50),
    db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, actor.userId), eq(groupMembers.status, "active"))).limit(40),
    db.select().from(activityFeed).where(eq(activityFeed.actorUserId, actor.userId)).orderBy(desc(activityFeed.createdAt)).limit(30),
    db.select().from(socialNotifications).where(eq(socialNotifications.recipientUserId, actor.userId)).orderBy(desc(socialNotifications.createdAt)).limit(20),
    db.select().from(meetRequests).where(or(eq(meetRequests.requesterUserId, actor.userId), eq(meetRequests.recipientUserId, actor.userId))).orderBy(desc(meetRequests.createdAt)).limit(20),
    db.select().from(socialReports).where(eq(socialReports.reporterUserId, actor.userId)).orderBy(desc(socialReports.createdAt)).limit(10),
    db.select().from(nightOutSessions).where(eq(nightOutSessions.userId, actor.userId)).orderBy(desc(nightOutSessions.createdAt)).limit(10),
  ]);

  const membershipGroupIds = Array.from(new Set(membershipRows.map((row) => row.groupId)));
  const groupRows = membershipGroupIds.length > 0
    ? await db.select().from(socialGroups).where(inArray(socialGroups.id, membershipGroupIds)).orderBy(desc(socialGroups.updatedAt)).limit(20)
    : [];

  const friendIds = friendRows.filter((row) => row.status === "active").map((row) => row.friendUserId);
  const friendProfileRows = friendIds.length > 0
    ? await db
        .select({
          userId: socialProfiles.userId,
          displayName: socialProfiles.displayName,
          handle: socialProfiles.handle,
          avatarUrl: socialProfiles.avatarUrl,
          bio: socialProfiles.bio,
          favoriteGenresJson: socialProfiles.favoriteGenresJson,
          favoriteVenuesJson: socialProfiles.favoriteVenuesJson,
          favoriteNeighborhoodsJson: socialProfiles.favoriteNeighborhoodsJson,
          nightlifePersonality: socialProfiles.nightlifePersonality,
          visibility: socialProfiles.visibility,
          socialBadgesJson: socialProfiles.socialBadgesJson,
          sharedFriendsCount: socialProfiles.sharedFriendsCount,
          friendCode: socialProfiles.friendCode,
          friendQrToken: socialProfiles.friendQrToken,
        })
        .from(socialProfiles)
        .where(inArray(socialProfiles.userId, friendIds))
    : [];

  const { blockedByViewerIds, viewerBlockedIds } = await getViewerIds(actor);

  const availableFriends = friendProfileRows.map((friend) => ({
    ...friend,
    favoriteGenres: parseList(friend.favoriteGenresJson),
    favoriteVenues: parseList(friend.favoriteVenuesJson),
    favoriteNeighborhoods: parseList(friend.favoriteNeighborhoodsJson),
    socialBadges: parseList(friend.socialBadgesJson),
  }));

  const requestProfiles = requestRows.length > 0
    ? await db
        .select({
          userId: socialProfiles.userId,
          displayName: socialProfiles.displayName,
          handle: socialProfiles.handle,
          avatarUrl: socialProfiles.avatarUrl,
          bio: socialProfiles.bio,
          sharedFriendsCount: socialProfiles.sharedFriendsCount,
        })
        .from(socialProfiles)
        .where(inArray(socialProfiles.userId, requestRows.map((row) => row.requesterUserId)))
    : [];

  const searchCandidates = await db
    .select({
      id: users.id,
      clerkUserId: users.clerkUserId,
      role: users.role,
      displayName: socialProfiles.displayName,
      handle: socialProfiles.handle,
      avatarUrl: socialProfiles.avatarUrl,
      bio: socialProfiles.bio,
      sharedFriendsCount: socialProfiles.sharedFriendsCount,
      visibility: socialProfiles.visibility,
    })
    .from(users)
    .leftJoin(socialProfiles, eq(socialProfiles.userId, users.id))
    .where(and(eq(users.role, "consumer"), sql`${users.id} <> ${actor.userId}`))
    .orderBy(desc(socialProfiles.sharedFriendsCount), desc(users.createdAt))
    .limit(40);

  const venueRows = await db.select({ id: venues.id, name: venues.name, neighborhood: venues.neighborhood, slug: venues.slug }).from(venues).orderBy(desc(venues.updatedAt)).limit(12);
  const eventRows = await db.select({ id: events.id, title: events.title, slug: events.slug, venueName: venues.name }).from(events).innerJoin(venues, eq(events.venueId, venues.id)).orderBy(desc(events.startsAt)).limit(12);

  const suggestions = searchCandidates
    .filter((candidate) => candidate.displayName && !blockedByViewerIds.has(candidate.id) && !viewerBlockedIds.has(candidate.id))
    .slice(0, 8)
    .map((candidate) => ({
      ...candidate,
      displayName: candidate.displayName ?? "Nightly member",
      handle: candidate.handle ?? "@nightly",
      avatarUrl: candidate.avatarUrl ?? null,
      bio: candidate.bio ?? null,
    }));

  const mutualFriendLookup = new Map<number, number>();
  for (const candidate of suggestions) {
    const mutualCount = friendRows.filter((row) => row.friendUserId === candidate.id).length;
    mutualFriendLookup.set(candidate.id, mutualCount);
  }

  return {
    actor,
    profile: {
      ...profile,
      interests: parseList(profile.interestsJson),
      favoriteGenres: parseList(profile.favoriteGenresJson),
      favoriteVenues: parseList(profile.favoriteVenuesJson),
      favoriteDjs: parseList(profile.favoriteDjsJson),
      favoriteNeighborhoods: parseList(profile.favoriteNeighborhoodsJson),
      socialBadges: parseList(profile.socialBadgesJson),
      activityStats: (() => {
        try {
          return JSON.parse(profile.activityStatsJson) as Record<string, number>;
        } catch {
          return {};
        }
      })(),
    },
    preferences: prefs,
    privacy,
    presence: presenceRow,
    requests: requestRows.map((request) => ({
      ...request,
      requesterProfile: requestProfiles.find((profileRow) => profileRow.userId === request.requesterUserId) ?? null,
    })),
    friends: availableFriends.map((friend) => ({
      ...friend,
      mutualFriends: mutualFriendLookup.get(friend.userId) ?? 0,
      isCloseFriend: favoriteRows.some((favorite) => favorite.friendUserId === friend.userId && favorite.isCloseFriend),
      isFavorite: favoriteRows.some((favorite) => favorite.friendUserId === friend.userId),
      isMuted: muteRows.some((mute) => mute.friendUserId === friend.userId),
    })),
    favorites: favoriteRows,
    mutes: muteRows,
    groups: groupRows,
    feed: feedRows.map((item) => ({
      ...item,
      label: socialActivityLabel(item.activityType as never),
      payload: (() => {
        try {
          return JSON.parse(item.payloadJson) as Record<string, unknown>;
        } catch {
          return {};
        }
      })(),
    })),
    notifications: notificationRows,
    meetRequests: meetRows,
    reports: reportRows,
    nightOutSessions: nightRows,
    suggestions: suggestions.map((candidate) => ({
      ...candidate,
      mutualFriends: mutualFriendLookup.get(candidate.id) ?? 0,
    })),
    nearbyVenues: venueRows,
    nearbyEvents: eventRows,
  };
}
