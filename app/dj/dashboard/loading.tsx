import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjDashboardLoading() {
  return (
    <RouteLoadingShell
      eyebrow="DJ Dashboard"
      title="Loading your dashboard"
      subtitle="Preparing profile highlights, mixes, and booking status."
      metricCount={3}
      cardCount={6}
      listCount={5}
    />
  );
}