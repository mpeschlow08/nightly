import { requireAdminActor } from "@/app/admin/lib/permissions";

export async function requireAdminUser() {
  const actor = await requireAdminActor();
  return { clerkUserId: actor.clerkUserId, role: "admin" as const };
}
