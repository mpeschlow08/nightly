import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function CrewsLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Crews"
      title="Loading crew hub"
      subtitle="Pulling active crews, votes, and plans for tonight."
      metricCount={3}
      cardCount={6}
      listCount={5}
    />
  );
}