import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const selectableUserRoles = ["consumer", "dj", "owner"] as const;
export type SelectableUserRole = (typeof selectableUserRoles)[number];

export type UserRole = SelectableUserRole | "admin";

const destinationByRole: Record<UserRole, string> = {
  consumer: "/home",
  dj: "/dj/onboarding",
  owner: "/owner/dashboard",
  admin: "/admin/analytics",
};

export function getRoleDestination(role: UserRole): string {
  return destinationByRole[role];
}

export async function getUserRole(clerkUserId: string): Promise<UserRole | null> {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { role: true },
  });

  return existing?.role ?? null;
}

export async function upsertUserRole(clerkUserId: string, role: UserRole): Promise<void> {
  const shouldResetOnboarding = role === "dj" || role === "owner";
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { id: true, isOnboarded: true },
  });

  const nextOnboarding = shouldResetOnboarding ? false : (existing?.isOnboarded ?? false);

  if (!existing) {
    await db.insert(users).values({
      clerkUserId,
      role,
      isOnboarded: nextOnboarding,
      isVerified: false,
      updatedAt: new Date(),
    });

    return;
  }

  await db
    .update(users)
    .set({
      role,
      isOnboarded: nextOnboarding,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, clerkUserId));
}
