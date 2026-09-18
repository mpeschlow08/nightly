export default function EventDetailLoading() {
  return (
    <div className="nightly-page min-h-screen overflow-x-hidden text-zinc-100 antialiased">
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="h-[19rem] animate-pulse rounded-[1.3rem] border border-white/10 bg-white/5" />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-[1.2rem] border border-white/10 bg-white/5" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-[1.2rem] border border-white/10 bg-white/5" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-[1.2rem] border border-white/10 bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}