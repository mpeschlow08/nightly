import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjMixesLoading() {
  return (
    <RouteLoadingShell
      eyebrow="DJ Mixes"
      title="Loading your mixes"
      subtitle="Collecting uploads, status, and playback previews."
      metricCount={2}
      cardCount={6}
      listCount={4}
    />
  );
}