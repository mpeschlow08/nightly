import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { djProfiles, djSampleMixes, users } from "@/db/schema";

export const DJ_GENRE_OPTIONS = [
  "Hip-Hop",
  "R&B",
  "Afrobeats",
  "Amapiano",
  "House",
  "Tech House",
  "Deep House",
  "EDM",
  "Top 40",
  "Reggaeton",
  "Latin",
  "Dancehall",
  "Trap",
  "Open Format",
] as const;

export const DJ_USERNAME_REGEX = /^[a-z0-9_-]+$/;

export type DjProfileRecord = typeof djProfiles.$inferSelect;
export type DjSampleMixRecord = typeof djSampleMixes.$inferSelect;

type UserRecord = {
  id: number;
  role: (typeof users.$inferSelect)["role"];
  isOnboarded: boolean;
};

async function getAuthenticatedUser() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: {
      id: true,
      role: true,
      isOnboarded: true,
    },
  });

  if (!user) {
    redirect("/select-role");
  }

  return user;
}

export async function requireDjForOnboarding() {
  const user = await getAuthenticatedUser();

  if (user.role !== "dj") {
    redirect("/select-role");
  }

  return user;
}

export async function requireDjForDashboard() {
  const user = await getAuthenticatedUser();

  if (user.role !== "dj") {
    redirect("/select-role");
  }

  if (!user.isOnboarded) {
    redirect("/dj/onboarding");
  }

  return user;
}

export async function requireDjProfileForDashboard() {
  const user = await requireDjForDashboard();
  const profile = await getDjProfileForUser(user.id);

  if (!profile) {
    redirect("/dj/onboarding");
  }

  return { user, profile };
}

export async function getDjProfileForUser(userId: number) {
  const profile = await db.query.djProfiles.findFirst({
    where: eq(djProfiles.userId, userId),
  });

  return profile ?? null;
}

export async function getDjPublicProfileByUsername(username: string) {
  const profile = await db.query.djProfiles.findFirst({
    where: eq(djProfiles.username, username),
  });

  return profile ?? null;
}

export async function getDjMixesForProfile(djProfileId: number) {
  return db.query.djSampleMixes.findMany({
    where: eq(djSampleMixes.djProfileId, djProfileId),
    orderBy: [desc(djSampleMixes.isFeatured), desc(djSampleMixes.createdAt), desc(djSampleMixes.id)],
  });
}

export async function getDjFeaturedPublicMixForProfile(djProfileId: number) {
  const mix = await db.query.djSampleMixes.findFirst({
    where: and(
      eq(djSampleMixes.djProfileId, djProfileId),
      eq(djSampleMixes.isFeatured, true),
      eq(djSampleMixes.isPublic, true)
    ),
    orderBy: [desc(djSampleMixes.updatedAt), desc(djSampleMixes.id)],
  });

  return mix ?? null;
}

export async function getDjMixSummaryForProfile(djProfileId: number) {
  const [counts] = await db
    .select({
      totalMixes: sql<number>`count(*)::int`,
      featuredMixes: sql<number>`count(*) filter (where ${djSampleMixes.isFeatured} = true)::int`,
    })
    .from(djSampleMixes)
    .where(eq(djSampleMixes.djProfileId, djProfileId));

  const featuredMix = await db.query.djSampleMixes.findFirst({
    where: and(eq(djSampleMixes.djProfileId, djProfileId), eq(djSampleMixes.isFeatured, true)),
    columns: {
      id: true,
      title: true,
      isPublic: true,
    },
    orderBy: [desc(djSampleMixes.updatedAt), desc(djSampleMixes.id)],
  });

  return {
    totalMixes: counts?.totalMixes ?? 0,
    featuredMixes: counts?.featuredMixes ?? 0,
    featuredMix,
  };
}

export async function getOwnedDjMixOrNull(mixId: number, djProfileId: number) {
  const mix = await db.query.djSampleMixes.findFirst({
    where: and(eq(djSampleMixes.id, mixId), eq(djSampleMixes.djProfileId, djProfileId)),
  });

  return mix ?? null;
}

export async function usernameTakenByAnotherUser(username: string, userId: number) {
  const existing = await db.query.djProfiles.findFirst({
    where: and(eq(djProfiles.username, username), ne(djProfiles.userId, userId)),
    columns: { id: true },
  });

  return Boolean(existing);
}

export function computeDjCompletion(profile: DjProfileRecord) {
  const checks = [
    profile.stageName.trim().length > 0,
    profile.username.trim().length > 0,
    profile.city != null && profile.city.trim().length > 0,
    profile.genres.length > 0,
    profile.bio != null && profile.bio.trim().length > 0,
    profile.bookingEmail != null && profile.bookingEmail.trim().length > 0,
    profile.rateCents != null,
  ];

  const completed = checks.filter(Boolean).length;
  const total = checks.length;

  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

export function formatCentsAsUsd(cents: number | null) {
  if (cents == null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function toUsernameSlug(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeGenres(values: string[]) {
  const allowed = new Set<string>(DJ_GENRE_OPTIONS);

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => allowed.has(value))
    )
  );
}

export type DjCurrentUser = UserRecord;
