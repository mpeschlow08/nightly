import { requireAdminUser } from "@/app/admin/lib/auth";
import { getAdminDiscoveryDebugSnapshot } from "@/lib/consumer/data";

export default async function AdminDiscoveryDebugPage() {
  await requireAdminUser();
  const snapshot = await getAdminDiscoveryDebugSnapshot();

  return (
    <main className="min-h-screen bg-[#04070b] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Admin Discovery Debug</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Discovery Engine Diagnostics</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Generated {snapshot.generatedAt.toLocaleString()} • Cache scope: {snapshot.cacheScope}
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Venue Candidates</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="text-zinc-400">
                <tr>
                  <th className="py-2">Venue</th>
                  <th className="py-2">Included</th>
                  <th className="py-2">Rank Score</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Exclusion</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.venueRows
                  .sort((a, b) => b.score - a.score)
                  .map((row) => (
                    <tr key={row.venueId} className="border-t border-white/10 text-zinc-200">
                      <td className="py-2">{row.venueName}</td>
                      <td className="py-2">{row.included ? "Yes" : "No"}</td>
                      <td className="py-2">{row.score.toFixed(3)}</td>
                      <td className="py-2">{row.reason}</td>
                      <td className="py-2">{row.exclusionReason ?? "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Event Candidates</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="text-zinc-400">
                <tr>
                  <th className="py-2">Event</th>
                  <th className="py-2">Included</th>
                  <th className="py-2">Rank Score</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Exclusion</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.eventRows
                  .sort((a, b) => b.score - a.score)
                  .map((row) => (
                    <tr key={row.eventId} className="border-t border-white/10 text-zinc-200">
                      <td className="py-2">{row.eventName}</td>
                      <td className="py-2">{row.included ? "Yes" : "No"}</td>
                      <td className="py-2">{row.score.toFixed(3)}</td>
                      <td className="py-2">{row.reason}</td>
                      <td className="py-2">{row.exclusionReason ?? "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
