import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Nightly"
      title="Warming up your night"
      subtitle="Loading tonight's highlights, maps, and recommendations."
      metricCount={3}
      cardCount={4}
      listCount={4}
    />
  );
}