import { getCurrentOwnerVenue } from "@/app/owner/lib/ownership";
import { requireAdminUser } from "@/app/admin/lib/auth";

export type VenueOsPermission =
  | "staff.manage"
  | "scheduling.manage"
  | "operations.manage"
  | "floor.manage"
  | "vip.manage"
  | "inventory.manage"
  | "crm.manage"
  | "marketing.manage"
  | "loyalty.manage"
  | "reports.view";

export type VenueOsActor =
  | {
      scope: "owner";
      venueId: number;
      clerkUserId: string;
      role: "owner" | "manager";
      permissions: VenueOsPermission[];
    }
  | {
      scope: "admin";
      venueId: null;
      clerkUserId: string;
      role: "admin";
      permissions: VenueOsPermission[];
    };

const managerPermissions: VenueOsPermission[] = [
  "staff.manage",
  "scheduling.manage",
  "operations.manage",
  "floor.manage",
  "vip.manage",
  "inventory.manage",
  "crm.manage",
  "reports.view",
];

const ownerPermissions: VenueOsPermission[] = [
  ...managerPermissions,
  "marketing.manage",
  "loyalty.manage",
];

export async function getVenueOsActor(): Promise<VenueOsActor> {
  try {
    const admin = await requireAdminUser();
    return {
      scope: "admin",
      venueId: null,
      clerkUserId: admin.clerkUserId,
      role: "admin",
      permissions: ownerPermissions,
    };
  } catch {
    const membership = await getCurrentOwnerVenue();

    return {
      scope: "owner",
      venueId: membership.venueId,
      clerkUserId: membership.clerkUserId,
      role: membership.role,
      permissions: membership.role === "owner" ? ownerPermissions : managerPermissions,
    };
  }
}

export async function requireVenueOsPermission(permission: VenueOsPermission) {
  const actor = await getVenueOsActor();

  if (!actor.permissions.includes(permission)) {
    throw new Error("Forbidden. VenueOS permission is required.");
  }

  return actor;
}