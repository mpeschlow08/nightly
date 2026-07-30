export default function CrewsLoading() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-5 sm:px-5 lg:px-6">
        <div className="h-[16rem] animate-pulse rounded-[1.5rem] border border-white/10 bg-white/5" />

        {Array.from({ length: 2 }).map((_, rowIndex) => (
          <section key={rowIndex} className="space-y-3">
            <div className="h-5 w-44 animate-pulse rounded-full bg-white/10" />
            <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
              {Array.from({ length: 2 }).map((__, cardIndex) => (
                <div key={`${rowIndex}-${cardIndex}`} className="h-[13.5rem] min-w-[16.5rem] animate-pulse rounded-[1.2rem] border border-white/10 bg-white/5" />
              ))}
            </div>
          </section>
        ))}

        <div className="space-y-3 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl border border-white/10 bg-black/25" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}