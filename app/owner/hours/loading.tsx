import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerHoursLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Business Hours"
      title="Loading hours settings"
      subtitle="Preparing schedules and late-night operating windows."
      metricCount={2}
      cardCount={3}
      listCount={4}
    />
  );
}