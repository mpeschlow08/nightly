"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getRoleDestination,
  selectableUserRoles,
  type SelectableUserRole,
  upsertUserRole,
} from "@/app/lib/user-roles";

function isSelectableRole(value: string): value is SelectableUserRole {
  return (selectableUserRoles as readonly string[]).includes(value);
}

export async function selectUserRole(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const selectedRole = formData.get("role");

  if (typeof selectedRole !== "string" || !isSelectableRole(selectedRole)) {
    throw new Error("Invalid role selection");
  }

  await upsertUserRole(userId, selectedRole);
  redirect(getRoleDestination(selectedRole));
}
