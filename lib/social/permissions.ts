import type { SocialVisibility } from "./types";

export type SocialAccessActor = {
  userId: number;
  clerkUserId: string;
  role: "consumer" | "dj" | "owner" | "admin";
};

export type SocialAccessTarget = {
  userId: number;
  profileVisibility: SocialVisibility;
  presenceVisibility: SocialVisibility;
  activityVisibility: SocialVisibility;
  blockedByViewer: boolean;
  viewerBlockedTarget: boolean;
  sharedFriendsCount?: number;
};

export function canViewSocialProfile(actor: SocialAccessActor, target: SocialAccessTarget) {
  if (actor.role === "admin") {
    return true;
  }

  if (target.blockedByViewer || target.viewerBlockedTarget) {
    return false;
  }

  if (target.profileVisibility === "public") {
    return true;
  }

  if (target.profileVisibility === "private") {
    return actor.userId === target.userId;
  }

  return target.sharedFriendsCount != null ? target.sharedFriendsCount > 0 || actor.userId === target.userId : actor.userId === target.userId;
}

export function canViewPresence(actor: SocialAccessActor, target: SocialAccessTarget) {
  if (actor.role === "admin") {
    return true;
  }

  if (target.blockedByViewer || target.viewerBlockedTarget) {
    return false;
  }

  if (target.presenceVisibility === "public") {
    return true;
  }

  if (target.presenceVisibility === "private") {
    return actor.userId === target.userId;
  }

  return actor.userId === target.userId || target.sharedFriendsCount != null && target.sharedFriendsCount > 0;
}

export function canViewActivity(actor: SocialAccessActor, target: SocialAccessTarget) {
  if (actor.role === "admin") {
    return true;
  }

  if (target.activityVisibility === "public") {
    return true;
  }

  if (target.activityVisibility === "private") {
    return actor.userId === target.userId;
  }

  return actor.userId === target.userId || target.sharedFriendsCount != null && target.sharedFriendsCount > 0;
}
