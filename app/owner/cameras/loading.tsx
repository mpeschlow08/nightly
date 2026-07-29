import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerCamerasLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Cameras"
      title="Loading camera manager"
      subtitle="Preparing live stream sources, status, and primary feed controls."
      metricCount={2}
      cardCount={4}
      listCount={4}
    />
  );
}
