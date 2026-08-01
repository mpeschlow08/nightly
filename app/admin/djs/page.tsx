import Link from "next/link";
import { desc } from "drizzle-orm";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { djProfiles } from "@/db/schema";

export default async function AdminDjsPage() {
  await requireAdminPermission("djs:view");

  const rows = await db.select().from(djProfiles).orderBy(desc(djProfiles.updatedAt)).limit(120);

  return (
    <main>
      <h1 className="text-2xl font-semibold text-white">DJs</h1>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Stage Name</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Booking</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((dj) => (
              <tr key={dj.id} className="border-t border-white/10 text-zinc-100">
                <td className="px-3 py-2"><Link href={`/admin/djs/${dj.id}`} className="text-cyan-300 hover:text-cyan-200">{dj.id}</Link></td>
                <td className="px-3 py-2">{dj.stageName}</td>
                <td className="px-3 py-2">{dj.username}</td>
                <td className="px-3 py-2">{dj.city ?? "-"}</td>
                <td className="px-3 py-2">{dj.isAvailableForBooking ? "Available" : "Unavailable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
