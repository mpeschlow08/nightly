import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function EventDetailLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Event"
      title="Loading event details"
      subtitle="Preparing lineup, set times, and venue atmosphere."
      metricCount={2}
      cardCount={4}
      listCount={5}
    />
  );
}