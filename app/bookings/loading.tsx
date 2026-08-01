import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function BookingsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <RouteLoadingShell
        eyebrow="Marketplace"
        title="Loading your bookings"
        subtitle="Pulling your request history, quotes, contracts, and payment timeline."
        metricCount={4}
        cardCount={4}
        listCount={4}
      />
    </div>
  );
}
