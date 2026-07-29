import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function MapLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Map"
      title="Rendering nightlife map"
      subtitle="Placing venues, live activity, and your nearby highlights."
      metricCount={3}
      cardCount={4}
      listCount={4}
    />
  );
}