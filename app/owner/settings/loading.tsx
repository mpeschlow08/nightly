import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerSettingsLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Owner Settings"
      title="Loading settings"
      subtitle="Fetching membership role, venue assignment, and account placeholders."
      metricCount={2}
      cardCount={3}
      listCount={3}
    />
  );
}
