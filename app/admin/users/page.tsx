import Link from "next/link";

import { getAdminUsersSnapshot } from "@/app/admin/lib/control-center-data";
import { requireAdminPermission } from "@/app/admin/lib/permissions";

export default async function AdminUsersPage() {
  await requireAdminPermission("users:view");
  const users = await getAdminUsersSnapshot(100);

  return (
    <main>
      <h1 className="text-2xl font-semibold text-white">Users</h1>
      <p className="mt-1 text-sm text-zinc-300">Global user directory for admin operations.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Clerk User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Re-verify</th>
              <th className="px-3 py-2">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/10 text-zinc-100">
                <td className="px-3 py-2">
                  <Link href={`/admin/users/${user.id}`} className="text-cyan-300 hover:text-cyan-200">
                    {user.id}
                  </Link>
                </td>
                <td className="px-3 py-2">{user.clerkUserId}</td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">{user.accountStatus}</td>
                <td className="px-3 py-2">{user.requiresReverification ? "Required" : "No"}</td>
                <td className="px-3 py-2">{user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
