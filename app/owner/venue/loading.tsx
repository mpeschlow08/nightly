import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerVenueLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Venue Profile"
      title="Loading venue profile"
      subtitle="Preparing details, amenities, and discoverability settings."
      metricCount={2}
      cardCount={4}
      listCount={4}
    />
  );
}