import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjProfileLoading() {
  return (
    <RouteLoadingShell
      eyebrow="DJ Profile"
      title="Loading profile view"
      subtitle="Pulling your public profile details and social links."
      metricCount={2}
      cardCount={4}
      listCount={4}
    />
  );
}