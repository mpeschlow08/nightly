import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjLoading() {
  return (
    <RouteLoadingShell
      eyebrow="DJ"
      title="Loading DJ workspace"
      subtitle="Syncing your dashboard context, profile, and music tools."
      metricCount={3}
      cardCount={5}
      listCount={5}
    />
  );
}