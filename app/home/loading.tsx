import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <RouteLoadingShell
        eyebrow="Consumer"
        title="Loading city pulse"
        subtitle="Syncing live energy, trending venues, and tonight's recommendations."
        metricCount={3}
        cardCount={6}
        listCount={5}
      />

      <div className="mx-auto mt-6 max-w-7xl space-y-6 px-4 pb-20 sm:px-6 lg:px-8">
        <div className="h-28 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl border border-cyan-400/20 bg-cyan-500/10" />
          <div className="h-24 animate-pulse rounded-2xl border border-violet-400/20 bg-violet-500/10" />
          <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      </div>
    </div>
  );
}