"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { getSocialActor } from "@/app/crews/lib/auth";
import { db } from "@/db";
import {
  directConversations,
  directMessageReactions,
  directMessages,
  friendBlocks,
  friends,
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
  socialNotifications,
  storyPosts,
  users,
} from "@/db/schema";
import { readSocialBlobMetadata, type SocialUploadKind } from "@/lib/social/media";
import { emitSocialRealtimeEvent } from "@/lib/social/realtime";
import { assertSocialRateLimit } from "@/lib/social/security";

function toTrimmedString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalInt(value: FormDataEntryValue | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: FormDataEntryValue | null | undefined) {
  return value === "on" || value === "true";
}

function toLines(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") {
    return [] as string[];
  }

  return value.split("\n").map((entry) => entry.trim()).filter(Boolean);
}

function toJson(value: Record<string, unknown> | string[]) {
  return JSON.stringify(value);
}

function redirectTo(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  redirect(`${path}?${query.toString()}`);
}

function revalidateSocial(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }

  revalidateTag("consumer:home", "max");
  revalidateTag("consumer:explore", "max");
  revalidateTag("consumer:live", "max");
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

async function queueSocialNotification(input: { recipientUserId: number; notificationType: string; payload: Record<string, unknown> }) {
  const recipient = await db.query.users.findFirst({
    where: eq(users.id, input.recipientUserId),
    columns: { id: true, clerkUserId: true },
  });

  if (!recipient) {
    return;
  }

  await db.insert(socialNotifications).values({
    recipientUserId: recipient.id,
    recipientClerkUserId: recipient.clerkUserId,
    notificationType: input.notificationType,
    payloadJson: JSON.stringify(input.payload),
  });
}

async function assertNotBlocked(viewerUserId: number, otherUserId: number) {
  const block = await db.query.friendBlocks.findFirst({
    where: or(
      and(eq(friendBlocks.blockerUserId, viewerUserId), eq(friendBlocks.blockedUserId, otherUserId)),
      and(eq(friendBlocks.blockerUserId, otherUserId), eq(friendBlocks.blockedUserId, viewerUserId))
    ),
  });

  if (block) {
    throw new Error("This user is unavailable for social actions.");
  }
}

async function assertDirectMessagingAllowed(viewerUserId: number, otherUserId: number) {
  await assertNotBlocked(viewerUserId, otherUserId);

  const friendship = await db.query.friends.findFirst({
    where: and(eq(friends.userId, viewerUserId), eq(friends.friendUserId, otherUserId), eq(friends.status, "active")),
  });

  if (!friendship) {
    throw new Error("Direct messaging is limited to active friends.");
  }
}

async function ensureGroupMember(groupId: number, userId: number) {
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });

  if (!membership || membership.status !== "active") {
    throw new Error("You do not have access to this group.");
  }

  return membership;
}

async function ensureGroupModerator(groupId: number, userId: number) {
  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });

  if (group.hostUserId !== userId && membership?.role !== "cohost") {
    throw new Error("Moderator access is required.");
  }

  return { group, membership };
}

async function ensureDirectConversation(viewerUserId: number, otherUserId: number) {
  await assertDirectMessagingAllowed(viewerUserId, otherUserId);

  const [userOneId, userTwoId] = [viewerUserId, otherUserId].sort((left, right) => left - right);
  const existing = await db.query.directConversations.findFirst({
    where: and(eq(directConversations.userOneId, userOneId), eq(directConversations.userTwoId, userTwoId)),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db.insert(directConversations).values({
    userOneId,
    userTwoId,
    createdByUserId: viewerUserId,
  }).returning();

  return created;
}

async function createDirectReceipts(messageId: number, senderUserId: number, conversationId: number) {
  const conversation = await db.query.directConversations.findFirst({
    where: eq(directConversations.id, conversationId),
  });

  if (!conversation) {
    return [] as number[];
  }

  const recipients = [conversation.userOneId, conversation.userTwoId].filter((userId) => userId !== senderUserId);
  if (recipients.length === 0) {
    return [] as number[];
  }

  const receiptRows = recipients.map((recipientUserId) => ({
    directMessageId: messageId,
    recipientUserId,
    status: "sent" as const,
  }));

  await db.insert(socialMessageReceipts).values(receiptRows);

  return recipients;
}

export async function sendDirectMessageAction(formData: FormData) {
  const actor = await getSocialActor();
  assertSocialRateLimit(`dm:${actor.userId}`, 12, 60_000);

  const friendUserId = toOptionalInt(formData.get("friendUserId"));
  const conversationId = toOptionalInt(formData.get("conversationId"));
  const body = toTrimmedString(formData.get("body"));
  const mediaAssetId = toOptionalInt(formData.get("mediaAssetId"));

  if (!body && !mediaAssetId) {
    throw new Error("Message body or media is required.");
  }

  const conversation = conversationId
    ? await db.query.directConversations.findFirst({ where: eq(directConversations.id, conversationId) })
    : friendUserId
      ? await ensureDirectConversation(actor.userId, friendUserId)
      : null;

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  if (![conversation.userOneId, conversation.userTwoId].includes(actor.userId)) {
    throw new Error("Conversation access denied.");
  }

  const [message] = await db.insert(directMessages).values({
    conversationId: conversation.id,
    senderUserId: actor.userId,
    senderClerkUserId: actor.clerkUserId,
    messageType: mediaAssetId ? "image" : "text",
    body: body || "Shared media",
    mentionsJson: toJson([]),
    metadataJson: toJson({}),
  }).returning();

  if (mediaAssetId) {
    await db.insert(socialMessageMedia).values({
      directMessageId: message.id,
      mediaAssetId,
    });
  }

  const recipients = await createDirectReceipts(message.id, actor.userId, conversation.id);
  await db.update(directConversations).set({
    lastMessageId: message.id,
    lastMessageAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(directConversations.id, conversation.id));

  await Promise.all(recipients.map((recipientUserId) => queueSocialNotification({
    recipientUserId,
    notificationType: "direct_message",
    payload: { conversationId: conversation.id, messageId: message.id, senderUserId: actor.userId },
  })));

  await emitSocialRealtimeEvent({
    topic: { kind: "conversation", id: conversation.id },
    name: "direct_message.created",
    payload: { conversationId: conversation.id, messageId: message.id, senderUserId: actor.userId },
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "direct_conversation", conversation.id, "direct_message_sent", { messageId: message.id });
  revalidateSocial(["/crews"]);
  redirectTo("/crews", { conversation: String(conversation.id) });
}

export async function markDirectConversationReadAction(formData: FormData) {
  const actor = await getSocialActor();
  const conversationId = toOptionalInt(formData.get("conversationId"));
  if (!conversationId) {
    throw new Error("Conversation is required.");
  }

  const messages = await db.select({ id: directMessages.id }).from(directMessages).where(eq(directMessages.conversationId, conversationId));
  const messageIds = messages.map((message) => message.id);
  if (messageIds.length > 0) {
    await db.update(socialMessageReceipts).set({ status: "read", readAt: new Date(), updatedAt: new Date() }).where(and(eq(socialMessageReceipts.recipientUserId, actor.userId), inArray(socialMessageReceipts.directMessageId, messageIds)));
  }

  revalidateSocial(["/crews"]);
  redirectTo("/crews", { conversation: String(conversationId), read: "1" });
}

export async function archiveDirectConversationAction(formData: FormData) {
  const actor = await getSocialActor();
  const conversationId = toOptionalInt(formData.get("conversationId"));
  if (!conversationId) {
    throw new Error("Conversation is required.");
  }

  const conversation = await db.query.directConversations.findFirst({ where: eq(directConversations.id, conversationId) });
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  await db.update(directConversations).set({
    archivedByUserOne: conversation.userOneId === actor.userId ? true : conversation.archivedByUserOne,
    archivedByUserTwo: conversation.userTwoId === actor.userId ? true : conversation.archivedByUserTwo,
    updatedAt: new Date(),
  }).where(eq(directConversations.id, conversationId));

  revalidateSocial(["/crews"]);
  redirectTo("/crews", { archivedConversation: String(conversationId) });
}

export async function deleteDirectConversationAction(formData: FormData) {
  const actor = await getSocialActor();
  const conversationId = toOptionalInt(formData.get("conversationId"));
  if (!conversationId) {
    throw new Error("Conversation is required.");
  }

  const conversation = await db.query.directConversations.findFirst({ where: eq(directConversations.id, conversationId) });
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  await db.update(directConversations).set({
    deletedByUserOneAt: conversation.userOneId === actor.userId ? new Date() : conversation.deletedByUserOneAt,
    deletedByUserTwoAt: conversation.userTwoId === actor.userId ? new Date() : conversation.deletedByUserTwoAt,
    updatedAt: new Date(),
  }).where(eq(directConversations.id, conversationId));

  revalidateSocial(["/crews"]);
  redirectTo("/crews", { deletedConversation: String(conversationId) });
}

export async function createGroupInviteAction(formData: FormData) {
  const actor = await getSocialActor();
  const groupId = toOptionalInt(formData.get("groupId"));
  const inviteeUserId = toOptionalInt(formData.get("inviteeUserId"));
  if (!groupId) {
    throw new Error("Group is required.");
  }

  const { group } = await ensureGroupModerator(groupId, actor.userId);
  const inviteCode = `GINV-${randomUUID().slice(0, 8).toUpperCase()}`;
  const expiresAtRaw = toTrimmedString(formData.get("expiresAt"));
  const [invite] = await db.insert(groupInvites).values({
    groupId,
    inviterUserId: actor.userId,
    inviteeUserId,
    inviteCode,
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    metadataJson: toJson({ slug: group.slug }),
  }).returning();

  if (inviteeUserId) {
    await queueSocialNotification({
      recipientUserId: inviteeUserId,
      notificationType: "group_invite",
      payload: { groupId, inviteId: invite.id, inviteCode },
    });
  }

  await writeSocialAudit(actor.clerkUserId, actor.role, "social_group", groupId, "group_invite_created", { inviteId: invite.id, inviteeUserId });
  revalidateSocial([`/crews/${group.slug}`]);
  redirectTo(`/crews/${group.slug}`, { inviteCreated: "1" });
}

export async function requestGroupJoinAction(formData: FormData) {
  const actor = await getSocialActor();
  const groupId = toOptionalInt(formData.get("groupId"));
  if (!groupId) {
    throw new Error("Group is required.");
  }

  const group = await db.query.socialGroups.findFirst({ where: eq(socialGroups.id, groupId) });
  if (!group) {
    throw new Error("Group not found.");
  }

  const [request] = await db.insert(groupJoinRequests).values({
    groupId,
    requesterUserId: actor.userId,
    requestMessage: toTrimmedString(formData.get("requestMessage")) || null,
  }).onConflictDoUpdate({
    target: [groupJoinRequests.groupId, groupJoinRequests.requesterUserId],
    set: { status: "pending", requestMessage: toTrimmedString(formData.get("requestMessage")) || null, updatedAt: new Date() },
  }).returning();

  await queueSocialNotification({
    recipientUserId: group.hostUserId,
    notificationType: "group_join_request",
    payload: { groupId, joinRequestId: request.id, requesterUserId: actor.userId },
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "social_group", groupId, "group_join_requested", { requestId: request.id });
  revalidateSocial([`/crews/${group.slug}`]);
  redirectTo(`/crews/${group.slug}`, { joinRequested: "1" });
}

export async function reviewGroupJoinRequestAction(formData: FormData) {
  const actor = await getSocialActor();
  const joinRequestId = toOptionalInt(formData.get("joinRequestId"));
  const decision = toTrimmedString(formData.get("decision"));
  if (!joinRequestId || !decision) {
    throw new Error("Join request review is incomplete.");
  }

  const request = await db.query.groupJoinRequests.findFirst({ where: eq(groupJoinRequests.id, joinRequestId) });
  if (!request) {
    throw new Error("Join request not found.");
  }

  const { group } = await ensureGroupModerator(request.groupId, actor.userId);
  const nextStatus = decision === "approve" ? "approved" : "declined";
  await db.update(groupJoinRequests).set({ status: nextStatus, reviewerUserId: actor.userId, responseMessage: toTrimmedString(formData.get("responseMessage")) || null, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(groupJoinRequests.id, joinRequestId));

  if (nextStatus === "approved") {
    await db.insert(groupMembers).values({
      groupId: request.groupId,
      userId: request.requesterUserId,
      clerkUserId: (await db.query.users.findFirst({ where: eq(users.id, request.requesterUserId), columns: { clerkUserId: true } }))?.clerkUserId ?? "",
      role: "member",
      status: "active",
      invitedByUserId: actor.userId,
      joinedAt: new Date(),
    }).onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: { status: "active", joinedAt: new Date(), updatedAt: new Date() },
    });
  }

  await queueSocialNotification({
    recipientUserId: request.requesterUserId,
    notificationType: nextStatus === "approved" ? "group_join_approved" : "group_join_declined",
    payload: { groupId: request.groupId, joinRequestId },
  });

  await writeSocialAudit(actor.clerkUserId, actor.role, "social_group", request.groupId, `group_join_${nextStatus}`, { joinRequestId });
  revalidateSocial([`/crews/${group.slug}`]);
  redirectTo(`/crews/${group.slug}`, { joinReview: nextStatus });
}

export async function transferGroupOwnershipAction(formData: FormData) {
  const actor = await getSocialActor();
  const groupId = toOptionalInt(formData.get("groupId"));
  const targetUserId = toOptionalInt(formData.get("targetUserId"));
  if (!groupId || !targetUserId) {
    throw new Error("Ownership transfer is incomplete.");
  }

  const group = await db.query.socialGroups.findFirst({ where: eq(socialGroups.id, groupId) });
  if (!group || group.hostUserId !== actor.userId) {
    throw new Error("Only the host can transfer ownership.");
  }

  const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId), columns: { clerkUserId: true } });
  if (!targetUser) {
    throw new Error("Target member not found.");
  }

  await ensureGroupMember(groupId, targetUserId);

  await db.update(socialGroups).set({ hostUserId: targetUserId, hostClerkUserId: targetUser.clerkUserId, updatedAt: new Date() }).where(eq(socialGroups.id, groupId));
  await db.update(groupMembers).set({ role: "cohost", updatedAt: new Date() }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actor.userId)));
  await db.update(groupMembers).set({ role: "host", updatedAt: new Date() }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));

  await writeSocialAudit(actor.clerkUserId, actor.role, "social_group", groupId, "group_ownership_transferred", { targetUserId });
  revalidateSocial([`/crews/${group.slug}`]);
  redirectTo(`/crews/${group.slug}`, { ownershipTransferred: "1" });
}

export async function createGroupPollAction(formData: FormData) {
  const actor = await getSocialActor();
  const groupId = toOptionalInt(formData.get("groupId"));
  const question = toTrimmedString(formData.get("question"));
  const options = toLines(formData.get("options"));
  if (!groupId || !question || options.length < 2) {
    throw new Error("Poll question and at least two options are required.");
  }

  await ensureGroupMember(groupId, actor.userId);
  const group = await db.query.socialGroups.findFirst({ where: eq(socialGroups.id, groupId), columns: { slug: true } });
  if (!group) {
    throw new Error("Group not found.");
  }

  const [poll] = await db.insert(groupPolls).values({
    groupId,
    creatorUserId: actor.userId,
    question,
    optionsJson: toJson(options),
    allowMultipleVotes: toBoolean(formData.get("allowMultipleVotes")),
    closesAt: toTrimmedString(formData.get("closesAt")) ? new Date(toTrimmedString(formData.get("closesAt"))) : null,
  }).returning();

  await writeSocialAudit(actor.clerkUserId, actor.role, "group_poll", poll.id, "group_poll_created", { groupId });
  revalidateSocial([`/crews/${group.slug}`]);
  redirectTo(`/crews/${group.slug}`, { pollCreated: "1" });
}

export async function voteGroupPollAction(formData: FormData) {
  const actor = await getSocialActor();
  const pollId = toOptionalInt(formData.get("pollId"));
  const optionLabel = toTrimmedString(formData.get("optionLabel"));
  if (!pollId || !optionLabel) {
    throw new Error("Poll vote is incomplete.");
  }

  const poll = await db.query.groupPolls.findFirst({ where: eq(groupPolls.id, pollId) });
  if (!poll) {
    throw new Error("Poll not found.");
  }

  await ensureGroupMember(poll.groupId, actor.userId);
  const options = JSON.parse(poll.optionsJson) as string[];
  if (!options.includes(optionLabel)) {
    throw new Error("Poll option is invalid.");
  }

  if (!poll.allowMultipleVotes) {
    await db.delete(groupVotes).where(and(eq(groupVotes.pollId, pollId), eq(groupVotes.userId, actor.userId)));
  }

  await db.insert(groupVotes).values({ pollId, userId: actor.userId, optionLabel }).onConflictDoNothing();
  const group = await db.query.socialGroups.findFirst({ where: eq(socialGroups.id, poll.groupId), columns: { slug: true } });
  revalidateSocial([`/crews/${group?.slug ?? ""}`]);
  redirectTo(`/crews/${group?.slug ?? ""}`, { pollVote: "1" });
}

export async function updateGroupMessageAction(formData: FormData) {
  const actor = await getSocialActor();
  const messageId = toOptionalInt(formData.get("messageId"));
  const body = toTrimmedString(formData.get("body"));
  const groupSlug = toTrimmedString(formData.get("groupSlug"));
  if (!messageId || !body || !groupSlug) {
    throw new Error("Message update is incomplete.");
  }

  const message = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, messageId) });
  if (!message || message.senderUserId !== actor.userId) {
    throw new Error("Only the sender can edit this message.");
  }

  await db.update(groupMessages).set({ body, editedAt: new Date(), updatedAt: new Date() }).where(eq(groupMessages.id, messageId));
  revalidateSocial([`/crews/${groupSlug}`]);
  redirectTo(`/crews/${groupSlug}`, { messageUpdated: "1" });
}

export async function deleteGroupMessageAction(formData: FormData) {
  const actor = await getSocialActor();
  const messageId = toOptionalInt(formData.get("messageId"));
  const groupSlug = toTrimmedString(formData.get("groupSlug"));
  if (!messageId || !groupSlug) {
    throw new Error("Message delete is incomplete.");
  }

  const message = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, messageId) });
  if (!message) {
    throw new Error("Message not found.");
  }

  const moderator = await ensureGroupModerator(message.groupId, actor.userId).catch(() => null);
  if (message.senderUserId !== actor.userId && !moderator) {
    throw new Error("You cannot delete this message.");
  }

  await db.update(groupMessages).set({ deletedAt: new Date(), deletedByUserId: actor.userId, body: "Message removed", updatedAt: new Date() }).where(eq(groupMessages.id, messageId));
  revalidateSocial([`/crews/${groupSlug}`]);
  redirectTo(`/crews/${groupSlug}`, { messageDeleted: "1" });
}

export async function toggleGroupMessageReactionAction(formData: FormData) {
  const actor = await getSocialActor();
  const messageId = toOptionalInt(formData.get("messageId"));
  const emoji = toTrimmedString(formData.get("emoji"));
  const groupSlug = toTrimmedString(formData.get("groupSlug"));
  if (!messageId || !emoji || !groupSlug) {
    throw new Error("Reaction is incomplete.");
  }

  const existing = await db.query.groupMessageReactions.findFirst({ where: and(eq(groupMessageReactions.messageId, messageId), eq(groupMessageReactions.userId, actor.userId), eq(groupMessageReactions.emoji, emoji)) });
  if (existing) {
    await db.delete(groupMessageReactions).where(eq(groupMessageReactions.id, existing.id));
  } else {
    await db.insert(groupMessageReactions).values({ messageId, userId: actor.userId, emoji });
  }

  revalidateSocial([`/crews/${groupSlug}`]);
  redirectTo(`/crews/${groupSlug}`, { reaction: "1" });
}

export async function createNightOutPlanAction(formData: FormData) {
  const actor = await getSocialActor();
  const groupId = toOptionalInt(formData.get("groupId"));
  const title = toTrimmedString(formData.get("title"));
  if (!groupId || !title) {
    throw new Error("Plan title is required.");
  }

  await ensureGroupMember(groupId, actor.userId);
  const group = await db.query.socialGroups.findFirst({ where: eq(socialGroups.id, groupId), columns: { slug: true } });
  if (!group) {
    throw new Error("Group not found.");
  }

  const [plan] = await db.insert(nightOutPlans).values({
    groupId,
    creatorUserId: actor.userId,
    title,
    description: toTrimmedString(formData.get("description")) || null,
    budgetLabel: toTrimmedString(formData.get("budgetLabel")) || null,
    transportationPlan: toTrimmedString(formData.get("transportationPlan")) || null,
    ticketCoordinationJson: toJson({ notes: toTrimmedString(formData.get("ticketNotes")) || null }),
    guestListCoordinationJson: toJson({ notes: toTrimmedString(formData.get("guestListNotes")) || null }),
    bottleReservationCoordinationJson: toJson({ notes: toTrimmedString(formData.get("bottleNotes")) || null }),
    aiSummary: toTrimmedString(formData.get("aiSummary")) || null,
  }).returning();

  await db.insert(nightOutPlanMembers).values({
    planId: plan.id,
    userId: actor.userId,
    role: "host",
    rsvpStatus: "going",
  }).onConflictDoNothing();

  revalidateSocial([`/crews/${group.slug}`]);
  redirectTo(`/crews/${group.slug}`, { planCreated: "1" });
}

export async function addNightOutPlanStopAction(formData: FormData) {
  const actor = await getSocialActor();
  const planId = toOptionalInt(formData.get("planId"));
  const title = toTrimmedString(formData.get("title"));
  const groupSlug = toTrimmedString(formData.get("groupSlug"));
  if (!planId || !title || !groupSlug) {
    throw new Error("Plan stop is incomplete.");
  }

  const plan = await db.query.nightOutPlans.findFirst({ where: eq(nightOutPlans.id, planId) });
  if (!plan || !plan.groupId) {
    throw new Error("Plan not found.");
  }

  await ensureGroupMember(plan.groupId, actor.userId);
  const existingStops = await db.select({ id: nightOutPlanStops.id }).from(nightOutPlanStops).where(eq(nightOutPlanStops.planId, planId));
  await db.insert(nightOutPlanStops).values({
    planId,
    title,
    venueId: toOptionalInt(formData.get("venueId")),
    eventId: toOptionalInt(formData.get("eventId")),
    etaMinutes: toOptionalInt(formData.get("etaMinutes")),
    arrivalWindow: toTrimmedString(formData.get("arrivalWindow")) || null,
    budgetLabel: toTrimmedString(formData.get("budgetLabel")) || null,
    notes: toTrimmedString(formData.get("notes")) || null,
    sortOrder: existingStops.length,
  });

  revalidateSocial([`/crews/${groupSlug}`]);
  redirectTo(`/crews/${groupSlug}`, { stopAdded: "1" });
}

export async function registerSocialMediaAssetAction(formData: FormData) {
  const actor = await getSocialActor();
  assertSocialRateLimit(`media:${actor.userId}`, 8, 60_000);

  const kind = toTrimmedString(formData.get("kind")) as SocialUploadKind;
  const blobUrl = toTrimmedString(formData.get("blobUrl"));
  if (!kind || !blobUrl) {
    throw new Error("Media registration is incomplete.");
  }

  const blob = await readSocialBlobMetadata({ blobUrl, userId: actor.userId, kind });
  const [asset] = await db.insert(mediaAssets).values({
    ownerUserId: actor.userId,
    uploaderUserId: actor.userId,
    groupId: toOptionalInt(formData.get("groupId")),
    directConversationId: toOptionalInt(formData.get("conversationId")),
    kind,
    moderationStatus: "pending",
    blobUrl: blob.url,
    thumbnailUrl: toTrimmedString(formData.get("thumbnailUrl")) || null,
    mimeType: blob.contentType,
    sizeBytes: blob.size,
    metadataJson: toJson({ pathname: blob.pathname }),
    expiresAt: toTrimmedString(formData.get("expiresAt")) ? new Date(toTrimmedString(formData.get("expiresAt"))) : null,
  }).returning();

  await writeSocialAudit(actor.clerkUserId, actor.role, "media_asset", asset.id, "media_registered", { kind });
  return { success: true, assetId: asset.id, url: asset.blobUrl } as const;
}

export async function createStoryPostAction(formData: FormData) {
  const actor = await getSocialActor();
  const mediaAssetId = toOptionalInt(formData.get("mediaAssetId"));
  if (!mediaAssetId) {
    throw new Error("Story media is required.");
  }

  const [story] = await db.insert(storyPosts).values({
    userId: actor.userId,
    mediaAssetId,
    caption: toTrimmedString(formData.get("caption")) || null,
    visibility: (toTrimmedString(formData.get("visibility")) as "public" | "friends" | "close_friends" | "private") || "friends",
    expiresAt: toTrimmedString(formData.get("expiresAt")) ? new Date(toTrimmedString(formData.get("expiresAt"))) : new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();

  await writeSocialAudit(actor.clerkUserId, actor.role, "story_post", story.id, "story_created");
  revalidateSocial(["/crews"]);
  redirectTo("/crews", { storyCreated: "1" });
}

export async function addDirectMessageReactionAction(formData: FormData) {
  const actor = await getSocialActor();
  const messageId = toOptionalInt(formData.get("messageId"));
  const emoji = toTrimmedString(formData.get("emoji"));
  if (!messageId || !emoji) {
    throw new Error("Reaction is incomplete.");
  }

  const existing = await db.query.directMessageReactions.findFirst({ where: and(eq(directMessageReactions.messageId, messageId), eq(directMessageReactions.userId, actor.userId), eq(directMessageReactions.emoji, emoji)) });
  if (existing) {
    await db.delete(directMessageReactions).where(eq(directMessageReactions.id, existing.id));
  } else {
    await db.insert(directMessageReactions).values({ messageId, userId: actor.userId, emoji });
  }

  revalidateSocial(["/crews"]);
  redirectTo("/crews", { reaction: "1" });
}