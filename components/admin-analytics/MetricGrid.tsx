import MetricCard from "@/components/admin-analytics/MetricCard";
import { MetricItem } from "@/components/admin-analytics/types";

type MetricGridProps = {
  metrics: MetricItem[];
};

export default function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <section aria-label="Key performance metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </section>
  );
}
