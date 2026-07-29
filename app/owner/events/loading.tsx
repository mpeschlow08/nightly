import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerEventsLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Owner Events"
      title="Loading event manager"
      subtitle="Syncing drafts, published events, and lineup details."
      metricCount={3}
      cardCount={5}
      listCount={4}
    />
  );
}