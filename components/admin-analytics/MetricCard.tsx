import TrendBadge from "@/components/admin-analytics/TrendBadge";
import { MetricItem } from "@/components/admin-analytics/types";

type MetricCardProps = {
  metric: MetricItem;
};

export default function MetricCard({ metric }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">{metric.label}</p>
      <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{metric.value}</p>

      <div className="mt-3 flex items-center gap-2">
        {metric.delta && metric.trend ? <TrendBadge delta={metric.delta} trend={metric.trend} /> : null}
        {metric.detail ? <span className="text-xs text-zinc-400">{metric.detail}</span> : null}
      </div>
    </article>
  );
}
