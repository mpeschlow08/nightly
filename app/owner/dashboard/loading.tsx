import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerDashboardLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Owner Dashboard"
      title="Loading venue dashboard"
      subtitle="Preparing tonight's pulse, performance, and quick actions."
      metricCount={3}
      cardCount={6}
      listCount={5}
    />
  );
}