import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export async function requireAdminUser() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized. Please sign in.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { role: true, clerkUserId: true },
  });

  if (!user || user.role !== "admin") {
    throw new Error("Forbidden. Admin access is required.");
  }

  return { clerkUserId: user.clerkUserId, role: user.role };
}
