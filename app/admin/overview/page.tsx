import { getOverviewMetrics } from "@/app/admin/lib/control-center-data";
import { requireAdminPermission } from "@/app/admin/lib/permissions";

const STATE_STYLES: Record<string, string> = {
  confirmed: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
  estimated: "border-amber-300/30 bg-amber-500/10 text-amber-200",
  pending: "border-orange-300/30 bg-orange-500/10 text-orange-200",
  unavailable: "border-zinc-300/20 bg-zinc-500/10 text-zinc-300",
};

export default async function AdminOverviewPage() {
  await requireAdminPermission("analytics:view");
  const metrics = await getOverviewMetrics();

  return (
    <main>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Enterprise Admin Control Center</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Platform Overview</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Values are labeled as confirmed, estimated, pending, or unavailable. No fabricated metrics are shown.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            <p
              className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.14em] ${STATE_STYLES[metric.state]}`}
            >
              {metric.state}
            </p>
            {metric.note ? <p className="mt-2 text-xs text-zinc-400">{metric.note}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
