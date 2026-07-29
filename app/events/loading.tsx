import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function EventsLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Events"
      title="Loading event lineup"
      subtitle="Syncing schedules, DJs, and venue details."
      metricCount={3}
      cardCount={6}
      listCount={4}
    />
  );
}