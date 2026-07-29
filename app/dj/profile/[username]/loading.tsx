import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjPublicProfileLoading() {
  return (
    <RouteLoadingShell
      eyebrow="DJ"
      title="Loading public profile"
      subtitle="Bringing in mixes, rates, and performance highlights."
      metricCount={2}
      cardCount={4}
      listCount={5}
    />
  );
}