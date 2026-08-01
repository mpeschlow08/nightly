import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getCurrentOwnerVenueOptional } from "@/app/owner/lib/ownership";
import { getUserRole } from "@/app/lib/user-roles";
import { db } from "@/db";
import { doorStaffAssignments, users } from "@/db/schema";
import type { TicketRoleContext } from "@/lib/ticketing/types";

async function getAuthenticatedTicketUser() {
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

  return user;
}

export async function getTicketActor(): Promise<TicketRoleContext> {
  const user = await getAuthenticatedTicketUser();
  const role = (await getUserRole(user.clerkUserId)) ?? user.role;

  const activeDoorAssignment = await db.query.doorStaffAssignments.findFirst({
    where: and(
      eq(doorStaffAssignments.clerkUserId, user.clerkUserId),
      eq(doorStaffAssignments.status, "active")
    ),
    orderBy: (fields, operators) => [operators.desc(fields.createdAt)],
  });

  if (activeDoorAssignment && role !== "admin" && role !== "owner") {
    return {
      clerkUserId: user.clerkUserId,
      role: "door_staff",
      userId: user.id,
      venueId: activeDoorAssignment.venueId,
      eventId: activeDoorAssignment.eventId,
      doorStaffAssignmentId: activeDoorAssignment.id,
    };
  }

  if (role === "dj") {
    return {
      clerkUserId: user.clerkUserId,
      role,
      userId: user.id,
    };
  }

  if (role === "owner") {
    const membership = await getCurrentOwnerVenueOptional();
    return {
      clerkUserId: user.clerkUserId,
      role,
      userId: user.id,
      venueId: membership?.venueId ?? null,
    };
  }

  return {
    clerkUserId: user.clerkUserId,
    role: role === "admin" ? "admin" : "consumer",
    userId: user.id,
  };
}

export async function requireConsumerTicketActor() {
  const actor = await getTicketActor();

  if (actor.role !== "consumer") {
    redirect("/tickets");
  }

  return actor;
}

export async function requireDoorStaffTicketActor() {
  const actor = await getTicketActor();
  if (actor.role !== "owner" && actor.role !== "admin" && actor.role !== "door_staff") {
    redirect("/tickets");
  }

  return actor;
}
