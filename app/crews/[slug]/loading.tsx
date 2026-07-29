import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function CrewDetailLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Crew"
      title="Loading crew details"
      subtitle="Building your crew activity, plans, and voting status."
      metricCount={2}
      cardCount={4}
      listCount={5}
    />
  );
}