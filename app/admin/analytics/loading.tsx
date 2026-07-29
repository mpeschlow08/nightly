import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function AdminAnalyticsLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Admin Analytics"
      title="Loading analytics view"
      subtitle="Crunching trends, growth curves, and platform performance."
      metricCount={4}
      cardCount={6}
      listCount={4}
    />
  );
}