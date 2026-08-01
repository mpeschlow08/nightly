import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getUserRole } from "@/app/lib/user-roles";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { SocialAccessActor } from "@/lib/social/permissions";

export async function getSocialActor(): Promise<SocialAccessActor> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { id: true, clerkUserId: true, role: true },
  });

  if (!user) {
    redirect("/select-role");
  }

  const role = (await getUserRole(user.clerkUserId)) ?? user.role;

  return {
    userId: user.id,
    clerkUserId: user.clerkUserId,
    role,
  };
}
