import Link from "next/link";
import { desc } from "drizzle-orm";

import { runVenueGoogleRefreshAction } from "@/app/admin/actions";
import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { venueClaimRequests, venues } from "@/db/schema";
import { getSchedulerState } from "@/lib/platform/venue-google-refresh";

export default async function AdminVenuesPage() {
  await requireAdminPermission("venues:view");
  const schedulerState = getSchedulerState();

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
        <h2 className="text-lg font-semibold text-white">Google refresh queue controls</h2>
        <p className="mt-1 text-sm text-zinc-300">Scheduler state: {schedulerState}. Use Run Now until scheduler integration is connected.</p>

        <form action={runVenueGoogleRefreshAction} className="mt-3 grid gap-3 md:grid-cols-4">
          <select
            name="mode"
            defaultValue="stale_only"
            className="rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="stale_only">Stale venues only</option>
            <option value="failed_only">Failed venues only</option>
            <option value="batch">Batch linked venues</option>
          </select>
          <input
            type="number"
            name="limit"
            min={1}
            max={100}
            defaultValue={25}
            className="rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100"
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">
            <input type="checkbox" name="dryRun" value="true" className="h-4 w-4 accent-cyan-500" />
            Dry run
          </label>
          <button type="submit" className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100">
            Run refresh now
          </button>
        </form>
      </section>

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
