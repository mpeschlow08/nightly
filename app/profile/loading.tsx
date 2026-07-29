import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function ProfileLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Profile"
      title="Loading your account"
      subtitle="Fetching identity settings, role details, and preferences."
      metricCount={2}
      cardCount={4}
      listCount={4}
    />
  );
}