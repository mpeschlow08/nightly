import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function ConciergeLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <RouteLoadingShell
        eyebrow="AI Concierge"
        title="Loading your Nightly concierge"
        subtitle="Pulling live discovery data, city pulse context, and your saved thread."
        metricCount={2}
        cardCount={4}
        listCount={3}
      />
    </div>
  );
}