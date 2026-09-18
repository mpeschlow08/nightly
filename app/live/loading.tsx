export default function LiveLoading() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
        <div className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5">
          <div className="h-56 animate-pulse bg-white/10" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-52 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/10" />
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="h-10 animate-pulse rounded-full bg-white/10" />
              <div className="h-10 animate-pulse rounded-full bg-white/10" />
              <div className="h-10 animate-pulse rounded-full bg-white/10" />
            </div>
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, sectionIndex) => (
          <section key={sectionIndex} className="space-y-3">
            <div className="h-5 w-44 animate-pulse rounded-full bg-white/10" />
            <div className="flex gap-3 overflow-hidden pb-1">
              {Array.from({ length: 2 }).map((__, cardIndex) => (
                <div
                  key={`${sectionIndex}-${cardIndex}`}
                  className="h-[12rem] min-w-[16rem] animate-pulse rounded-[1.15rem] border border-white/10 bg-white/5"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
