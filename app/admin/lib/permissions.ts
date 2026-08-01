import { auth } from "@clerk/nextjs/server";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  adminAssignments,
  adminRolePermissions,
  adminRoles,
  users,
} from "@/db/schema";

export const ADMIN_PERMISSIONS = [
  "users:view",
  "users:modify",
  "users:suspend",
  "venues:view",
  "venues:approve",
  "venues:suspend",
  "djs:view",
  "djs:approve",
  "events:view",
  "events:moderate",
  "bookings:view",
  "bookings:override",
  "tickets:view",
  "tickets:override",
  "payments:view",
  "refunds:approve",
  "disputes:view",
  "disputes:resolve",
  "fraud:view",
  "fraud:resolve",
  "reports:view",
  "content:moderate",
  "support:view",
  "support:resolve",
  "analytics:view",
  "revenue:view",
  "subscriptions:view",
  "flags:manage",
  "jobs:manage",
  "health:view",
  "announcements:publish",
  "exports:create",
  "audit:view",
  "support_view:use",
  "roles:manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminActor = {
  clerkUserId: string;
  isSuperAdmin: boolean;
  permissions: Set<AdminPermission>;
};

function asPermissionSet(values: string[]) {
  return new Set(values.filter((value): value is AdminPermission =>
    (ADMIN_PERMISSIONS as readonly string[]).includes(value)
  ));
}

export async function requireAdminActor(): Promise<AdminActor> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized. Please sign in.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { clerkUserId: true, role: true, accountStatus: true },
  });

  if (!user || user.role !== "admin" || user.accountStatus !== "active") {
    throw new Error("Forbidden. Active admin access is required.");
  }

  const now = new Date();
  const assignments = await db
    .select({ id: adminAssignments.id, roleId: adminAssignments.roleId })
    .from(adminAssignments)
    .where(
      and(
        eq(adminAssignments.clerkUserId, userId),
        eq(adminAssignments.status, "active"),
        or(isNull(adminAssignments.expiresAt), gt(adminAssignments.expiresAt, now))
      )
    );

  if (assignments.length === 0) {
    throw new Error("Forbidden. Active admin assignment is required.");
  }

  const roleIds = assignments.map((item) => item.roleId);

  const [roleRows, permissionRows] = await Promise.all([
    db
      .select({ key: adminRoles.key })
      .from(adminRoles)
      .where(inArray(adminRoles.id, roleIds)),
    db
      .select({ permission: adminRolePermissions.permission })
      .from(adminRolePermissions)
      .where(inArray(adminRolePermissions.roleId, roleIds)),
  ]);

  const isSuperAdmin = roleRows.some((row) => row.key === "super_admin");

  return {
    clerkUserId: user.clerkUserId,
    isSuperAdmin,
    permissions: isSuperAdmin
      ? new Set(ADMIN_PERMISSIONS)
      : asPermissionSet(permissionRows.map((row) => row.permission)),
  };
}

export async function requireAdminPermission(permission: AdminPermission) {
  const actor = await requireAdminActor();

  if (!actor.isSuperAdmin && !actor.permissions.has(permission)) {
    throw new Error(`Forbidden. Missing permission: ${permission}.`);
  }

  return actor;
}
