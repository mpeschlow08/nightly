export const socialVisibilityOptions = ["public", "friends", "close_friends", "private"] as const;
export type SocialVisibility = (typeof socialVisibilityOptions)[number];

export const friendRequestStatusOptions = ["pending", "accepted", "declined", "cancelled", "blocked", "expired"] as const;
export type FriendRequestStatus = (typeof friendRequestStatusOptions)[number];

export const friendRelationshipStatusOptions = ["active", "removed", "muted"] as const;
export type FriendRelationshipStatus = (typeof friendRelationshipStatusOptions)[number];

export const groupVisibilityOptions = ["public", "private"] as const;
export type GroupVisibility = (typeof groupVisibilityOptions)[number];

export const groupMemberRoleOptions = ["host", "cohost", "member"] as const;
export type GroupMemberRole = (typeof groupMemberRoleOptions)[number];

export const groupMemberStatusOptions = ["invited", "active", "left", "kicked"] as const;
export type GroupMemberStatus = (typeof groupMemberStatusOptions)[number];

export const groupMessageTypeOptions = ["text", "image", "gif", "system", "reply", "video", "voice", "thread_reply"] as const;
export type GroupMessageType = (typeof groupMessageTypeOptions)[number];

export const groupPollStatusOptions = ["open", "closed", "cancelled"] as const;
export type GroupPollStatus = (typeof groupPollStatusOptions)[number];

export const nightOutStatusOptions = ["active", "ended", "expired"] as const;
export type NightOutStatus = (typeof nightOutStatusOptions)[number];

export const nightOutLocationModeOptions = ["venue_only", "approximate", "exact", "invisible"] as const;
export type NightOutLocationMode = (typeof nightOutLocationModeOptions)[number];

export const presenceStatusOptions = ["offline", "online", "idle", "heading_out", "at_venue", "changing_venue", "leaving", "night_over", "hidden"] as const;
export type PresenceStatus = (typeof presenceStatusOptions)[number];

export const meetRequestTypeOptions = ["meet_here", "im_lost", "find_my_friends", "group_eta", "pinned_meeting_spot", "walking_handoff", "emergency_regroup", "venue_pin"] as const;
export type MeetRequestType = (typeof meetRequestTypeOptions)[number];

export const meetRequestStatusOptions = ["pending", "accepted", "declined", "expired", "cancelled"] as const;
export type MeetRequestStatus = (typeof meetRequestStatusOptions)[number];

export const socialNotificationStatusOptions = ["queued", "processing", "sent", "read", "failed", "dismissed"] as const;
export type SocialNotificationStatus = (typeof socialNotificationStatusOptions)[number];

export const socialReportStatusOptions = ["open", "in_review", "resolved", "dismissed"] as const;
export type SocialReportStatus = (typeof socialReportStatusOptions)[number];

export const socialMessageReceiptStatusOptions = ["sent", "delivered", "read"] as const;
export type SocialMessageReceiptStatus = (typeof socialMessageReceiptStatusOptions)[number];

export const socialMediaAssetKindOptions = ["image", "video", "voice", "story", "thumbnail"] as const;
export type SocialMediaAssetKind = (typeof socialMediaAssetKindOptions)[number];

export const socialMediaModerationStatusOptions = ["pending", "approved", "rejected"] as const;
export type SocialMediaModerationStatus = (typeof socialMediaModerationStatusOptions)[number];

export const socialGroupInviteStatusOptions = ["active", "accepted", "expired", "revoked"] as const;
export type SocialGroupInviteStatus = (typeof socialGroupInviteStatusOptions)[number];

export const socialGroupJoinRequestStatusOptions = ["pending", "approved", "declined", "cancelled"] as const;
export type SocialGroupJoinRequestStatus = (typeof socialGroupJoinRequestStatusOptions)[number];

export const socialStoryPostStatusOptions = ["active", "expired", "archived"] as const;
export type SocialStoryPostStatus = (typeof socialStoryPostStatusOptions)[number];
