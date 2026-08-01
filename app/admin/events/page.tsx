import Link from "next/link";
import { desc } from "drizzle-orm";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { events } from "@/db/schema";

export default async function AdminEventsPage() {
  await requireAdminPermission("events:view");
  const rows = await db.select().from(events).orderBy(desc(events.createdAt)).limit(120);

  return (
    <main>
      <h1 className="text-2xl font-semibold text-white">Events</h1>
      <p className="mt-1 text-sm text-zinc-300">Moderation, publication, and sales oversight.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Venue</th>
              <th className="px-3 py-2">Approval</th>
              <th className="px-3 py-2">Publication</th>
              <th className="px-3 py-2">Start</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr key={event.id} className="border-t border-white/10 text-zinc-100">
                <td className="px-3 py-2"><Link href={`/admin/events/${event.id}`} className="text-cyan-300 hover:text-cyan-200">{event.id}</Link></td>
                <td className="px-3 py-2">{event.title}</td>
                <td className="px-3 py-2">{event.venueId}</td>
                <td className="px-3 py-2">{event.approvalStatus}</td>
                <td className="px-3 py-2">{event.publicationStatus}</td>
                <td className="px-3 py-2">{event.startsAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
