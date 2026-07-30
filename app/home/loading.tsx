export default function HomeLoading() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="mx-auto max-w-3xl space-y-7 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
        <div className="h-40 animate-pulse rounded-[1.25rem] border border-white/10 bg-white/5" />

        {Array.from({ length: 5 }).map((_, sectionIndex) => (
          <section key={sectionIndex} className="space-y-3">
            <div className="h-5 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="-mx-4 flex gap-3 overflow-x-hidden px-4 sm:-mx-5 sm:px-5">
              {Array.from({ length: 2 }).map((__, cardIndex) => (
                <div key={`${sectionIndex}-${cardIndex}`} className="h-[18.8rem] min-w-[17.2rem] animate-pulse rounded-[1.2rem] border border-white/10 bg-white/5" />
              ))}
            </div>
          </section>
        ))}

        <div className="h-14" />
      </div>
    </div>
  );
}