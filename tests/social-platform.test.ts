import assert from "node:assert/strict";
import test from "node:test";

import { canViewActivity, canViewPresence, canViewSocialProfile, type SocialAccessActor, type SocialAccessTarget } from "@/lib/social/permissions";
import { createSocialRealtimeAdapter, buildSocialRealtimeChannels } from "@/lib/social/realtime";
import { assertSocialRateLimit, resetSocialRateLimit } from "@/lib/social/security";
import { generateFriendCode, issueFriendQrToken, verifyFriendQrToken } from "@/lib/social/token";

const actor: SocialAccessActor = {
  userId: 1,
  clerkUserId: "user_1",
  role: "consumer",
};

const target: SocialAccessTarget = {
  userId: 2,
  profileVisibility: "friends",
  presenceVisibility: "friends",
  activityVisibility: "friends",
  blockedByViewer: false,
  viewerBlockedTarget: false,
  sharedFriendsCount: 3,
};

test("social permissions allow friend-visible profile access with mutuals", () => {
  assert.equal(canViewSocialProfile(actor, target), true);
  assert.equal(canViewPresence(actor, target), true);
  assert.equal(canViewActivity(actor, target), true);
});

test("social permissions block access when either side is blocked", () => {
  assert.equal(canViewSocialProfile(actor, { ...target, blockedByViewer: true }), false);
  assert.equal(canViewPresence(actor, { ...target, viewerBlockedTarget: true }), false);
});

test("friend QR token round-trip stays verifiable", () => {
  process.env.SOCIAL_TOKEN_SECRET = "test-social-secret";
  const friendCode = generateFriendCode();
  const token = issueFriendQrToken(friendCode);
  const verified = verifyFriendQrToken(token);

  assert.equal(verified?.friendCode, friendCode);
});

test("realtime adapter exposes consistent channels", () => {
  const adapter = createSocialRealtimeAdapter("noop");
  const channels = buildSocialRealtimeChannels({ userId: 12, groupId: 7, conversationId: 22 });

  assert.equal(adapter.provider, "noop");
  assert.equal(channels.group, "social.group.7");
  assert.equal(channels.conversation, "social.conversation.22");
  assert.equal(channels.typingConversation, "social.conversation.22.typing");
});

test("social rate limit trips after configured limit", () => {
  resetSocialRateLimit("messages");

  assert.doesNotThrow(() => assertSocialRateLimit("messages", 2, 60_000));
  assert.doesNotThrow(() => assertSocialRateLimit("messages", 2, 60_000));
  assert.throws(() => assertSocialRateLimit("messages", 2, 60_000));
});