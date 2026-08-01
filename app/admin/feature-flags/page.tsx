import { desc } from "drizzle-orm";

import {
  disableFeatureFlagAction,
  upsertFeatureFlagAction,
} from "@/app/admin/actions";
import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { platformFeatureFlagHistory, platformFeatureFlags } from "@/db/schema";

export default async function AdminFeatureFlagsPage() {
  await requireAdminPermission("flags:manage");

  const [flags, history] = await Promise.all([
    db.select().from(platformFeatureFlags).orderBy(desc(platformFeatureFlags.updatedAt)).limit(120),
    db.select().from(platformFeatureFlagHistory).orderBy(desc(platformFeatureFlagHistory.createdAt)).limit(120),
  ]);

  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-white">Feature Flags</h1>
        <p className="text-sm text-zinc-300">Server-side evaluation controls for global and scoped rollouts.</p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Create or update flag</h2>
        <form action={upsertFeatureFlagAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <input name="key" required placeholder="flag key (e.g. venue_intelligence)" className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm" />
          <input name="environment" required defaultValue="production" className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm" />
          <input name="description" required placeholder="description" className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm md:col-span-2" />
          <textarea name="reason" required placeholder="reason" className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm md:col-span-2" />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" name="enabled" className="h-4 w-4" /> Enabled
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs uppercase tracking-[0.12em] text-cyan-100">Save flag</button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Active flags</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="px-2 py-1">Key</th>
                <th className="px-2 py-1">Enabled</th>
                <th className="px-2 py-1">Env</th>
                <th className="px-2 py-1">Kill switch</th>
                <th className="px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-t border-white/10">
                  <td className="px-2 py-1">{flag.key}</td>
                  <td className="px-2 py-1">{flag.enabled ? "Yes" : "No"}</td>
                  <td className="px-2 py-1">{flag.environment}</td>
                  <td className="px-2 py-1">{flag.killSwitch ? "On" : "Off"}</td>
                  <td className="px-2 py-1">
                    <form action={disableFeatureFlagAction} className="inline-flex gap-2">
                      <input type="hidden" name="flagId" value={flag.id} />
                      <input name="reason" required placeholder="reason" className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs" />
                      <button type="submit" className="rounded border border-rose-300/40 bg-rose-500/20 px-2 py-1 text-xs text-rose-100">Kill</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">History</h2>
        <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(history, null, 2)}</pre>
      </section>
    </main>
  );
}
