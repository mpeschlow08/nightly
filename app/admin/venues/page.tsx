import Link from "next/link";
import { desc } from "drizzle-orm";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { venueClaimRequests, venues } from "@/db/schema";

export default async function AdminVenuesPage() {
  await requireAdminPermission("venues:view");

  const [venueRows, claimRows] = await Promise.all([
    db.select().from(venues).orderBy(desc(venues.updatedAt)).limit(120),
    db.select().from(venueClaimRequests).orderBy(desc(venueClaimRequests.createdAt)).limit(50),
  ]);

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-white">Venues</h1>
        <p className="text-sm text-zinc-300">Search, review publication status, and inspect ownership context.</p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Recent venues</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="px-2 py-1">Venue</th>
                <th className="px-2 py-1">Publication</th>
                <th className="px-2 py-1">Verification</th>
                <th className="px-2 py-1">Updated</th>
              </tr>
            </thead>
            <tbody>
              {venueRows.map((venue) => (
                <tr key={venue.id} className="border-t border-white/10">
                  <td className="px-2 py-1">
                    <Link href={`/admin/venues/${venue.id}`} className="text-cyan-300 hover:text-cyan-200">{venue.name}</Link>
                  </td>
                  <td className="px-2 py-1">{venue.publicationStatus}</td>
                  <td className="px-2 py-1">{venue.verificationStatus}</td>
                  <td className="px-2 py-1">{venue.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Claim queue snapshot</h2>
        <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(claimRows, null, 2)}</pre>
      </section>
    </main>
  );
}
