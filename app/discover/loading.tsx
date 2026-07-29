import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DiscoverLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Discover"
      title="Scanning the city"
      subtitle="Finding trending venues and fresh sets for tonight."
      metricCount={3}
      cardCount={8}
      listCount={4}
    />
  );
}