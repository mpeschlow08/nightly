"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  platformFeatureFlagHistory,
  platformFeatureFlags,
  users,
  venues,
} from "@/db/schema";

import { writeAdminAuditEvent } from "@/app/admin/lib/audit";
import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { runVenueGoogleDataRefresh } from "@/lib/platform/venue-google-refresh";

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = formData.get(key);
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function getInt(formData: FormData, key: string, label: string) {
  const text = getRequiredText(formData, key, label);
  const value = Number.parseInt(text, 10);

  if (!Number.isFinite(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function getOptionalBool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function suspendUserAction(formData: FormData) {
  const actor = await requireAdminPermission("users:suspend");
  const userId = getInt(formData, "userId", "User ID");
  const reason = getRequiredText(formData, "reason", "Reason");
  let beforeState: { accountStatus: string; suspendedAt: Date | null; requiresReverification: boolean } | null = null;

  await db.transaction(async (tx) => {
    const current = await tx.query.users.findFirst({ where: eq(users.id, userId) });

    if (!current) {
      throw new Error("User not found.");
    }

    await tx
      .update(users)
      .set({
        accountStatus: "suspended",
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    beforeState = {
      accountStatus: current.accountStatus,
      suspendedAt: current.suspendedAt,
      requiresReverification: current.requiresReverification,
    };
  });

  const beforeAudit = beforeState ?? {
    accountStatus: "unknown",
    suspendedAt: null,
    requiresReverification: false,
  };

  await writeAdminAuditEvent({
    actorClerkUserId: actor.clerkUserId,
    action: "admin_user_suspended",
    resourceType: "user",
    resourceId: userId,
    scope: "users",
    reason,
    before: {
      accountStatus: beforeAudit.accountStatus,
      suspendedAt: beforeAudit.suspendedAt,
    },
    after: {
      accountStatus: "suspended",
    },
    metadata: {
      requiresReverification: beforeAudit.requiresReverification,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function restoreUserAction(formData: FormData) {
  const actor = await requireAdminPermission("users:suspend");
  const userId = getInt(formData, "userId", "User ID");
  const reason = getRequiredText(formData, "reason", "Reason");
  let beforeState: { accountStatus: string; suspendedAt: Date | null } | null = null;

  await db.transaction(async (tx) => {
    const current = await tx.query.users.findFirst({ where: eq(users.id, userId) });

    if (!current) {
      throw new Error("User not found.");
    }

    await tx
      .update(users)
      .set({
        accountStatus: "active",
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    beforeState = {
      accountStatus: current.accountStatus,
      suspendedAt: current.suspendedAt,
    };
  });

  const beforeAudit = beforeState ?? {
    accountStatus: "unknown",
    suspendedAt: null,
  };

  await writeAdminAuditEvent({
    actorClerkUserId: actor.clerkUserId,
    action: "admin_user_restored",
    resourceType: "user",
    resourceId: userId,
    scope: "users",
    reason,
    before: {
      accountStatus: beforeAudit.accountStatus,
      suspendedAt: beforeAudit.suspendedAt,
    },
    after: {
      accountStatus: "active",
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function requireReverificationAction(formData: FormData) {
  const actor = await requireAdminPermission("users:modify");
  const userId = getInt(formData, "userId", "User ID");
  const reason = getRequiredText(formData, "reason", "Reason");

  const current = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (!current) {
    throw new Error("User not found.");
  }

  await db
    .update(users)
    .set({ requiresReverification: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAdminAuditEvent({
    actorClerkUserId: actor.clerkUserId,
    action: "admin_user_reverification_required",
    resourceType: "user",
    resourceId: userId,
    scope: "users",
    reason,
    before: { requiresReverification: current.requiresReverification },
    after: { requiresReverification: true },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function upsertFeatureFlagAction(formData: FormData) {
  const actor = await requireAdminPermission("flags:manage");
  const key = getRequiredText(formData, "key", "Flag key").toLowerCase();
  const reason = getRequiredText(formData, "reason", "Reason");
  const enabled = formData.get("enabled") === "on";
  const description = getRequiredText(formData, "description", "Description");
  const environment = getRequiredText(formData, "environment", "Environment");

  const existing = await db.query.platformFeatureFlags.findFirst({
    where: eq(platformFeatureFlags.key, key),
  });

  if (existing) {
    await db
      .update(platformFeatureFlags)
      .set({
        description,
        enabled,
        environment,
        updatedByClerkUserId: actor.clerkUserId,
        updatedAt: new Date(),
      })
      .where(eq(platformFeatureFlags.id, existing.id));

    await db.insert(platformFeatureFlagHistory).values({
      flagId: existing.id,
      actorClerkUserId: actor.clerkUserId,
      action: "updated",
      reason,
      beforeJson: JSON.stringify({
        enabled: existing.enabled,
        description: existing.description,
        environment: existing.environment,
      }),
      afterJson: JSON.stringify({ enabled, description, environment }),
    });

    await writeAdminAuditEvent({
      actorClerkUserId: actor.clerkUserId,
      action: "admin_feature_flag_changed",
      resourceType: "platform_feature_flag",
      resourceId: existing.id,
      scope: "feature_flags",
      reason,
      before: { enabled: existing.enabled, environment: existing.environment },
      after: { enabled, environment },
      metadata: { key },
    });
  } else {
    const [created] = await db
      .insert(platformFeatureFlags)
      .values({
        key,
        description,
        enabled,
        environment,
        updatedByClerkUserId: actor.clerkUserId,
      })
      .returning({ id: platformFeatureFlags.id });

    await db.insert(platformFeatureFlagHistory).values({
      flagId: created.id,
      actorClerkUserId: actor.clerkUserId,
      action: "created",
      reason,
      afterJson: JSON.stringify({ enabled, description, environment }),
    });

    await writeAdminAuditEvent({
      actorClerkUserId: actor.clerkUserId,
      action: "admin_feature_flag_changed",
      resourceType: "platform_feature_flag",
      resourceId: created.id,
      scope: "feature_flags",
      reason,
      after: { enabled, environment },
      metadata: { key, created: true },
    });
  }

  revalidatePath("/admin/feature-flags");
}

export async function disableFeatureFlagAction(formData: FormData) {
  const actor = await requireAdminPermission("flags:manage");
  const flagId = getInt(formData, "flagId", "Flag ID");
  const reason = getRequiredText(formData, "reason", "Reason");

  const existing = await db.query.platformFeatureFlags.findFirst({
    where: and(eq(platformFeatureFlags.id, flagId), eq(platformFeatureFlags.enabled, true)),
  });

  if (!existing) {
    throw new Error("Enabled feature flag not found.");
  }

  await db
    .update(platformFeatureFlags)
    .set({
      enabled: false,
      killSwitch: true,
      updatedByClerkUserId: actor.clerkUserId,
      updatedAt: new Date(),
    })
    .where(eq(platformFeatureFlags.id, flagId));

  await db.insert(platformFeatureFlagHistory).values({
    flagId,
    actorClerkUserId: actor.clerkUserId,
    action: "kill_switch",
    reason,
    beforeJson: JSON.stringify({ enabled: true, killSwitch: existing.killSwitch }),
    afterJson: JSON.stringify({ enabled: false, killSwitch: true }),
  });

  await writeAdminAuditEvent({
    actorClerkUserId: actor.clerkUserId,
    action: "admin_feature_flag_changed",
    resourceType: "platform_feature_flag",
    resourceId: flagId,
    scope: "feature_flags",
    reason,
    before: { enabled: true, killSwitch: existing.killSwitch },
    after: { enabled: false, killSwitch: true },
    metadata: { key: existing.key, action: "kill_switch" },
  });

  revalidatePath("/admin/feature-flags");
}

export async function runVenueGoogleRefreshAction(formData: FormData) {
  const actor = await requireAdminPermission("jobs:manage");
  const venueIdRaw = formData.get("venueId");
  const mode = getRequiredText(formData, "mode", "Mode") as "single" | "batch" | "stale_only" | "failed_only";
  const dryRun = getOptionalBool(formData, "dryRun");
  const force = getOptionalBool(formData, "force");
  const limitRaw = formData.get("limit");
  const limit = typeof limitRaw === "string" && limitRaw.trim().length > 0 ? Number.parseInt(limitRaw, 10) : undefined;
  const venueId =
    typeof venueIdRaw === "string" && venueIdRaw.trim().length > 0
      ? Number.parseInt(venueIdRaw, 10)
      : undefined;

  const result = await runVenueGoogleDataRefresh({
    mode,
    venueId,
    limit,
    dryRun,
    force,
    trigger: "admin",
    requestedByClerkUserId: actor.clerkUserId,
  });

  await writeAdminAuditEvent({
    actorClerkUserId: actor.clerkUserId,
    action: "admin_venue_google_refresh_run",
    resourceType: "venue_google_refresh_run",
    resourceId: result.runId,
    scope: "venues",
    reason: "Admin initiated venue Google data refresh",
    after: {
      mode,
      venueId: venueId ?? null,
      dryRun,
      force,
      selectedVenueCount: result.selectedVenueCount,
      requestCount: result.requestCount,
      failedCount: result.failedCount,
    },
  });

  revalidatePath("/admin/venues");
  revalidatePath("/admin/overview");

  if (venueId) {
    revalidatePath(`/admin/venues/${venueId}`);
  }
}

export async function setVenueGoogleRefreshSuspendedAction(formData: FormData) {
  const actor = await requireAdminPermission("venues:approve");
  const venueId = getInt(formData, "venueId", "Venue ID");
  const suspend = getOptionalBool(formData, "suspend");
  const reason = getRequiredText(formData, "reason", "Reason");

  const current = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });

  if (!current) {
    throw new Error("Venue not found.");
  }

  await db
    .update(venues)
    .set({
      googleRefreshSuspendedAt: suspend ? new Date() : null,
      googleRefreshStatus: suspend ? "suspended" : current.googleRefreshStatus,
      updatedAt: new Date(),
    })
    .where(eq(venues.id, venueId));

  await writeAdminAuditEvent({
    actorClerkUserId: actor.clerkUserId,
    action: "admin_venue_google_refresh_suspension_changed",
    resourceType: "venue",
    resourceId: venueId,
    scope: "venues",
    reason,
    before: { googleRefreshSuspendedAt: current.googleRefreshSuspendedAt?.toISOString() ?? null },
    after: { googleRefreshSuspendedAt: suspend ? new Date().toISOString() : null },
  });

  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath("/admin/venues");
}
