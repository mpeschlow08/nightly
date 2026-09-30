import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { users, venueMembers } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/platform/feature-access";
import { SocialPublishingError } from "./errors";
import { mayManageSocialPublishing } from "./authorization-policy";

export type SocialActorAction = "view" | "publish" | "retry" | "revoke" | "review" | "manage_accounts" | "manage_policy";
export type AuthorizedSocialActor = {
  userId: number;
  clerkUserId: string;
  role: "owner";
  venueId: number;
};

export async function requireSocialPublishingActor(venueId: number, action: SocialActorAction): Promise<AuthorizedSocialActor> {
  const ownerActions: ReadonlySet<SocialActorAction> = new Set(["view", "publish", "retry", "revoke", "review", "manage_accounts", "manage_policy"]);
  if (!ownerActions.has(action)) throw new SocialPublishingError("forbidden", 403);
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new SocialPublishingError("unauthorized", 401);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkUserId, clerkUserId), eq(users.accountStatus, "active")))
    .limit(1);
  if (!user) throw new SocialPublishingError("forbidden", 403);

  const [membership] = await db
    .select({ role: venueMembers.role })
    .from(venueMembers)
    .where(and(eq(venueMembers.venueId, venueId), eq(venueMembers.clerkUserId, clerkUserId)))
    .limit(1);

  if (mayManageSocialPublishing({ isActiveUser: true, venueMembershipRole: membership?.role ?? null, venueMatches: membership !== undefined })) {
    const enabled = await isFeatureEnabled("feature.social_publishing", { userId: clerkUserId, role: "owner", venueId });
    if (!enabled) throw new SocialPublishingError("feature_disabled", 503);
    return { userId: user.id, clerkUserId, role: "owner", venueId };
  }

  throw new SocialPublishingError("forbidden", 403);
}
