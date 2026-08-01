import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";

import { getSocialActor } from "@/app/crews/lib/auth";
import { db } from "@/db";
import {
  events,
  groupInvites,
  groupJoinRequests,
  groupMembers,
  groupMessageReactions,
  groupMessages,
  groupPolls,
  groupVotes,
  mediaAssets,
  nightOutPlanMembers,
  nightOutPlans,
  nightOutPlanStops,
  socialGroups,
  socialMessageMedia,
  socialMessageReceipts,
  socialProfiles,
  storyPosts,
  venues,
} from "@/db/schema";

function parseJsonRecord(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function parseJsonList(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

export async function getSocialGroupPageData(slug: string, beforeMessageId?: number | null) {
  const actor = await getSocialActor();

  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.slug, slug),
  });

  if (!group) {
    return null;
  }

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, actor.userId)),
  });

  const canModerate = actor.role === "admin" || group.hostUserId === actor.userId || membership?.role === "cohost";
  const isMember = membership?.status === "active" || group.hostUserId === actor.userId;

  if (group.visibility === "private" && !isMember && actor.role !== "admin") {
    return null;
  }

  const members = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      role: groupMembers.role,
      status: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
      permissionOverridesJson: groupMembers.permissionOverridesJson,
      displayName: socialProfiles.displayName,
      handle: socialProfiles.handle,
      avatarUrl: socialProfiles.avatarUrl,
    })
    .from(groupMembers)
    .innerJoin(socialProfiles, eq(socialProfiles.userId, groupMembers.userId))
    .where(eq(groupMembers.groupId, group.id))
    .orderBy(asc(groupMembers.role), asc(groupMembers.createdAt));

  const messageCondition = beforeMessageId
    ? and(eq(groupMessages.groupId, group.id), lt(groupMessages.id, beforeMessageId))
    : eq(groupMessages.groupId, group.id);

  const messages = await db
    .select({
      id: groupMessages.id,
      senderUserId: groupMessages.senderUserId,
      displayName: socialProfiles.displayName,
      handle: socialProfiles.handle,
      avatarUrl: socialProfiles.avatarUrl,
      messageType: groupMessages.messageType,
      body: groupMessages.body,
      mediaUrl: groupMessages.mediaUrl,
      replyToMessageId: groupMessages.replyToMessageId,
      threadRootMessageId: groupMessages.threadRootMessageId,
      mentionsJson: groupMessages.mentionsJson,
      metadataJson: groupMessages.metadataJson,
      reactionsCount: groupMessages.reactionsCount,
      deliveredCount: groupMessages.deliveredCount,
      readCount: groupMessages.readCount,
      editedAt: groupMessages.editedAt,
      deletedAt: groupMessages.deletedAt,
      createdAt: groupMessages.createdAt,
    })
    .from(groupMessages)
    .innerJoin(socialProfiles, eq(socialProfiles.userId, groupMessages.senderUserId))
    .where(messageCondition)
    .orderBy(desc(groupMessages.id))
    .limit(25);

  const orderedMessages = [...messages].reverse();
  const messageIds = orderedMessages.map((message) => message.id);

  const reactions = messageIds.length > 0
    ? await db
        .select({
          messageId: groupMessageReactions.messageId,
          userId: groupMessageReactions.userId,
          emoji: groupMessageReactions.emoji,
          createdAt: groupMessageReactions.createdAt,
        })
        .from(groupMessageReactions)
        .where(inArray(groupMessageReactions.messageId, messageIds))
    : [];

  const receipts = messageIds.length > 0
    ? await db
        .select({
          groupMessageId: socialMessageReceipts.groupMessageId,
          recipientUserId: socialMessageReceipts.recipientUserId,
          status: socialMessageReceipts.status,
          deliveredAt: socialMessageReceipts.deliveredAt,
          readAt: socialMessageReceipts.readAt,
        })
        .from(socialMessageReceipts)
        .where(inArray(socialMessageReceipts.groupMessageId, messageIds))
    : [];

  const messageMedia = messageIds.length > 0
    ? await db
        .select({
          groupMessageId: socialMessageMedia.groupMessageId,
          mediaAssetId: mediaAssets.id,
          kind: mediaAssets.kind,
          blobUrl: mediaAssets.blobUrl,
          thumbnailUrl: mediaAssets.thumbnailUrl,
          moderationStatus: mediaAssets.moderationStatus,
          metadataJson: mediaAssets.metadataJson,
        })
        .from(socialMessageMedia)
        .innerJoin(mediaAssets, eq(mediaAssets.id, socialMessageMedia.mediaAssetId))
        .where(inArray(socialMessageMedia.groupMessageId, messageIds))
    : [];

  const polls = await db
    .select()
    .from(groupPolls)
    .where(eq(groupPolls.groupId, group.id))
    .orderBy(desc(groupPolls.createdAt));

  const votes = polls.length > 0
    ? await db
        .select()
        .from(groupVotes)
        .where(inArray(groupVotes.pollId, polls.map((poll) => poll.id)))
        .orderBy(desc(groupVotes.createdAt))
    : [];

  const plans = await db
    .select()
    .from(nightOutPlans)
    .where(eq(nightOutPlans.groupId, group.id))
    .orderBy(desc(nightOutPlans.createdAt));

  const planIds = plans.map((plan) => plan.id);

  const planStops = planIds.length > 0
    ? await db
        .select({
          id: nightOutPlanStops.id,
          planId: nightOutPlanStops.planId,
          title: nightOutPlanStops.title,
          sortOrder: nightOutPlanStops.sortOrder,
          etaMinutes: nightOutPlanStops.etaMinutes,
          arrivalWindow: nightOutPlanStops.arrivalWindow,
          budgetLabel: nightOutPlanStops.budgetLabel,
          notes: nightOutPlanStops.notes,
          venueName: venues.name,
          eventTitle: events.title,
        })
        .from(nightOutPlanStops)
        .leftJoin(venues, eq(venues.id, nightOutPlanStops.venueId))
        .leftJoin(events, eq(events.id, nightOutPlanStops.eventId))
        .where(inArray(nightOutPlanStops.planId, planIds))
        .orderBy(asc(nightOutPlanStops.sortOrder), asc(nightOutPlanStops.id))
    : [];

  const planMembers = planIds.length > 0
    ? await db
        .select({
          planId: nightOutPlanMembers.planId,
          userId: nightOutPlanMembers.userId,
          role: nightOutPlanMembers.role,
          rsvpStatus: nightOutPlanMembers.rsvpStatus,
          displayName: socialProfiles.displayName,
          handle: socialProfiles.handle,
        })
        .from(nightOutPlanMembers)
        .innerJoin(socialProfiles, eq(socialProfiles.userId, nightOutPlanMembers.userId))
        .where(inArray(nightOutPlanMembers.planId, planIds))
    : [];

  const invites = canModerate
    ? await db
        .select()
        .from(groupInvites)
        .where(eq(groupInvites.groupId, group.id))
        .orderBy(desc(groupInvites.createdAt))
    : [];

  const joinRequests = canModerate
    ? await db
        .select({
          id: groupJoinRequests.id,
          requesterUserId: groupJoinRequests.requesterUserId,
          status: groupJoinRequests.status,
          requestMessage: groupJoinRequests.requestMessage,
          reviewedAt: groupJoinRequests.reviewedAt,
          createdAt: groupJoinRequests.createdAt,
          displayName: socialProfiles.displayName,
          handle: socialProfiles.handle,
        })
        .from(groupJoinRequests)
        .innerJoin(socialProfiles, eq(socialProfiles.userId, groupJoinRequests.requesterUserId))
        .where(eq(groupJoinRequests.groupId, group.id))
        .orderBy(desc(groupJoinRequests.createdAt))
    : [];

  const stories = await db
    .select({
      id: storyPosts.id,
      caption: storyPosts.caption,
      visibility: storyPosts.visibility,
      expiresAt: storyPosts.expiresAt,
      createdAt: storyPosts.createdAt,
      displayName: socialProfiles.displayName,
      handle: socialProfiles.handle,
      mediaKind: mediaAssets.kind,
      blobUrl: mediaAssets.blobUrl,
      thumbnailUrl: mediaAssets.thumbnailUrl,
    })
    .from(storyPosts)
    .innerJoin(mediaAssets, eq(mediaAssets.id, storyPosts.mediaAssetId))
    .innerJoin(socialProfiles, eq(socialProfiles.userId, storyPosts.userId))
    .where(and(eq(mediaAssets.groupId, group.id), eq(storyPosts.status, "active")))
    .orderBy(desc(storyPosts.createdAt))
    .limit(12);

  return {
    actor,
    group,
    membership,
    canModerate,
    members: members.map((member) => ({
      ...member,
      permissionOverrides: parseJsonRecord(member.permissionOverridesJson),
    })),
    messages: orderedMessages.map((message) => ({
      ...message,
      mentions: parseJsonList(message.mentionsJson),
      metadata: parseJsonRecord(message.metadataJson),
      reactions: reactions.filter((reaction) => reaction.messageId === message.id),
      receipts: receipts.filter((receipt) => receipt.groupMessageId === message.id),
      media: messageMedia
        .filter((asset) => asset.groupMessageId === message.id)
        .map((asset) => ({
          ...asset,
          metadata: parseJsonRecord(asset.metadataJson),
        })),
    })),
    polls: polls.map((poll) => ({
      ...poll,
      options: parseJsonList(poll.optionsJson),
      votes: votes.filter((vote) => vote.pollId === poll.id),
    })),
    plans: plans.map((plan) => ({
      ...plan,
      ticketCoordination: parseJsonRecord(plan.ticketCoordinationJson),
      guestListCoordination: parseJsonRecord(plan.guestListCoordinationJson),
      bottleReservationCoordination: parseJsonRecord(plan.bottleReservationCoordinationJson),
      stops: planStops.filter((stop) => stop.planId === plan.id),
      members: planMembers.filter((member) => member.planId === plan.id),
    })),
    invites,
    joinRequests,
    stories,
    hasMoreMessages: messages.length === 25,
    nextMessageCursor: orderedMessages[0]?.id ?? null,
  };
}