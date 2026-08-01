import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function BookingDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <RouteLoadingShell
        eyebrow="Marketplace"
        title="Loading booking details"
        subtitle="Pulling the timeline, messages, contracts, and payment records."
        metricCount={4}
        cardCount={3}
        listCount={5}
      />
    </div>
  );
}
