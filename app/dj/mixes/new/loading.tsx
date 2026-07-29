import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjNewMixLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Upload"
      title="Loading mix uploader"
      subtitle="Preparing upload fields, tags, and audio validation."
      metricCount={2}
      cardCount={3}
      listCount={4}
    />
  );
}