import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function VenueLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Venue"
      title="Loading venue details"
      subtitle="Preparing photos, tonight's pulse, and key venue data."
      metricCount={2}
      cardCount={5}
      listCount={4}
    />
  );
}