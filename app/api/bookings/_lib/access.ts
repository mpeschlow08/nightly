import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { getUserRole } from "@/app/lib/user-roles";
import { db } from "@/db";
import { bookings, doorStaffAssignments, serverAssignments, tableBookings, users, venueMembers, venueServers, venueStaffProfiles } from "@/db/schema";

export type ReservationApiActor = {
  clerkUserId: string;
  role: "consumer" | "dj" | "owner" | "admin" | "server" | "door_staff";
  userId: number;
  venueId: number | null;
  serverId: number | null;
};

export async function getReservationApiActor(): Promise<ReservationApiActor | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { id: true, clerkUserId: true, role: true },
  });

  if (!user) {
    return null;
  }

  const appRole = (await getUserRole(clerkUserId)) ?? user.role;

  const [membership, staffProfile, doorAssignment] = await Promise.all([
    db.query.venueMembers.findFirst({
      where: eq(venueMembers.clerkUserId, clerkUserId),
      columns: { venueId: true, role: true },
    }),
    db.query.venueStaffProfiles.findFirst({
      where: and(eq(venueStaffProfiles.clerkUserId, clerkUserId), eq(venueStaffProfiles.status, "active")),
      columns: { id: true, venueId: true, department: true },
    }),
    db.query.doorStaffAssignments.findFirst({
      where: and(eq(doorStaffAssignments.clerkUserId, clerkUserId), eq(doorStaffAssignments.status, "active")),
      columns: { venueId: true },
    }),
  ]);

  const serverProfile = staffProfile
    ? await db.query.venueServers.findFirst({
        where: and(eq(venueServers.staffProfileId, staffProfile.id), eq(venueServers.isActive, true)),
        columns: { id: true, venueId: true },
      })
    : null;

  if (appRole === "admin") {
    return {
      clerkUserId,
      role: "admin",
      userId: user.id,
      venueId: membership?.venueId ?? doorAssignment?.venueId ?? staffProfile?.venueId ?? null,
      serverId: serverProfile?.id ?? null,
    };
  }

  if (appRole === "owner" && membership) {
    return {
      clerkUserId,
      role: "owner",
      userId: user.id,
      venueId: membership.venueId,
      serverId: null,
    };
  }

  if (doorAssignment) {
    return {
      clerkUserId,
      role: "door_staff",
      userId: user.id,
      venueId: doorAssignment.venueId,
      serverId: null,
    };
  }

  if (staffProfile?.department === "vip" || serverProfile) {
    return {
      clerkUserId,
      role: "server",
      userId: user.id,
      venueId: serverProfile?.venueId ?? staffProfile?.venueId ?? null,
      serverId: serverProfile?.id ?? null,
    };
  }

  return {
    clerkUserId,
    role: appRole,
    userId: user.id,
    venueId: membership?.venueId ?? staffProfile?.venueId ?? null,
    serverId: null,
  };
}

export function canManageVenueReservations(actor: ReservationApiActor | null) {
  if (!actor) {
    return false;
  }

  return actor.role === "admin" || actor.role === "owner" || actor.role === "door_staff" || actor.role === "server";
}

export async function canAccessBooking(actor: ReservationApiActor | null, bookingId: number) {
  if (!actor) {
    return false;
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      venueId: bookings.venueId,
      consumerClerkUserId: bookings.consumerClerkUserId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "consumer") {
    return actor.clerkUserId === booking.consumerClerkUserId;
  }

  if ((actor.role === "owner" || actor.role === "door_staff") && actor.venueId) {
    return actor.venueId === booking.venueId;
  }

  if (actor.role === "server") {
    if (!actor.serverId || !actor.venueId) {
      return false;
    }

    const [assigned] = await db
      .select({ id: serverAssignments.id })
      .from(serverAssignments)
      .where(
        and(
          eq(serverAssignments.bookingId, bookingId),
          eq(serverAssignments.serverId, actor.serverId),
          eq(serverAssignments.venueId, actor.venueId)
        )
      )
      .limit(1);

    return Boolean(assigned);
  }

  return false;
}

export async function getBookingVenueId(bookingId: number) {
  const [row] = await db
    .select({ venueId: tableBookings.venueId })
    .from(tableBookings)
    .where(eq(tableBookings.bookingId, bookingId))
    .limit(1);

  return row?.venueId ?? null;
}
