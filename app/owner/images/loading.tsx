import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OwnerImagesLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Gallery"
      title="Loading image manager"
      subtitle="Fetching venue gallery and upload controls."
      metricCount={2}
      cardCount={6}
      listCount={3}
    />
  );
}