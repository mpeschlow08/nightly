import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function HomeLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Consumer"
      title="Loading home feed"
      subtitle="Pulling your nearby events, crews, and live vibe picks."
      metricCount={3}
      cardCount={6}
      listCount={5}
    />
  );
}