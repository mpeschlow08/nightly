import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function AdminLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Admin"
      title="Loading admin console"
      subtitle="Preparing system metrics and platform health snapshots."
      metricCount={4}
      cardCount={6}
      listCount={5}
    />
  );
}