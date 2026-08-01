import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { getLaunchReadinessSnapshot } from "@/lib/platform/launch-readiness";

export default async function LaunchReadinessPage() {
  await requireAdminPermission("health:view");

  const snapshot = await getLaunchReadinessSnapshot();

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Launch Readiness</h1>
        <p className="text-sm text-zinc-300">
          Controlled internal beta readiness snapshot with no secret exposure.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card title="Go/No-Go" value={snapshot.goNoGo === "go" ? "GO" : "NO GO"} />
        <Card title="Readiness Status" value={snapshot.readiness.status.toUpperCase()} />
        <Card title="Open Critical Risks" value={String(snapshot.riskSummary.openCriticalRisks)} />
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">Blockers</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {snapshot.blockers.length === 0 ? <li>No active launch blockers recorded.</li> : snapshot.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">Snapshot</h2>
        <pre className="mt-3 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(snapshot, null, 2)}</pre>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">Beta V1 Scope</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Included: {snapshot.betaScope.includedFeatures.length} features. Deferred: {snapshot.betaScope.deferredFeatures.length} features.
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          Required flags present: {snapshot.betaScope.coverage.present}/{snapshot.betaScope.coverage.required}. Missing: {snapshot.betaScope.missingFlags.length}.
        </p>
        <pre className="mt-3 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(snapshot.betaScope, null, 2)}</pre>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}
