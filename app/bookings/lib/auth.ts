import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getUserRole } from "@/app/lib/user-roles";
import { getDjProfileForUser } from "@/app/dj/lib/data";
import { getCurrentOwnerVenueOptional } from "@/app/owner/lib/ownership";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { BookingRoleContext } from "@/lib/bookings/types";

type BookingUserRow = {
  id: number;
  clerkUserId: string;
  role: BookingRoleContext["role"];
};

async function getAuthenticatedBookingUser() {
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

  return user as BookingUserRow;
}

export async function getBookingActor(): Promise<BookingRoleContext> {
  const user = await getAuthenticatedBookingUser();
  const role = (await getUserRole(user.clerkUserId)) ?? user.role;

  if (role === "dj") {
    const profile = await getDjProfileForUser(user.id);

    if (!profile) {
      redirect("/dj/onboarding");
    }

    return {
      clerkUserId: user.clerkUserId,
      role,
      djProfileId: profile.id,
    };
  }

  if (role === "owner") {
    const membership = await getCurrentOwnerVenueOptional();

    if (!membership) {
      redirect("/owner/claim");
    }

    return {
      clerkUserId: user.clerkUserId,
      role,
      venueId: membership.venueId,
    };
  }

  return {
    clerkUserId: user.clerkUserId,
    role: role ?? "consumer",
  };
}

export async function requireConsumerBookingActor() {
  const actor = await getBookingActor();

  if (actor.role !== "consumer") {
    redirect("/home");
  }

  return actor;
}

export async function requireDjBookingActor() {
  const actor = await getBookingActor();

  if (actor.role !== "dj") {
    redirect("/dj/bookings");
  }

  return actor;
}

export async function requireOwnerBookingActor() {
  const actor = await getBookingActor();

  if (actor.role !== "owner") {
    redirect("/owner/bookings");
  }

  return actor;
}

export async function requireAdminBookingActor() {
  const actor = await getBookingActor();

  if (actor.role !== "admin") {
    redirect("/admin/bookings");
  }

  return actor;
}
