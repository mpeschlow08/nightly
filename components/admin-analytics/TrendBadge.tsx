import { MetricTrend } from "@/components/admin-analytics/types";

type TrendBadgeProps = {
  delta: string;
  trend: MetricTrend;
};

const trendStyles: Record<MetricTrend, string> = {
  up: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
  down: "text-rose-300 border-rose-400/30 bg-rose-500/10",
  flat: "text-zinc-300 border-white/20 bg-white/10",
};

export default function TrendBadge({ delta, trend }: TrendBadgeProps) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${trendStyles[trend]}`}>{delta}</span>;
}
