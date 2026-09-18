export default function DiscoverLoading() {
  return (
    <div className="nightly-page overflow-x-hidden">
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-4 sm:px-5 lg:px-8">
        <div className="h-14 animate-pulse rounded-[1rem] border border-[color:var(--border)] bg-white/5" />
        <div className="h-11 animate-pulse rounded-[1rem] border border-[color:var(--border)] bg-white/5" />
        <div className="h-12 animate-pulse rounded-full bg-white/8" />
        <div className="h-56 animate-pulse rounded-[1.3rem] border border-[color:var(--border)] bg-white/5" />

        {Array.from({ length: 6 }).map((_, sectionIndex) => (
          <section key={sectionIndex} className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="-mx-4 flex gap-3 overflow-x-hidden px-4 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
              {Array.from({ length: 2 }).map((__, cardIndex) => (
                <div
                  key={`${sectionIndex}-${cardIndex}`}
                  className="h-[18.8rem] min-w-[17.2rem] animate-pulse rounded-[1.2rem] border border-[color:var(--border)] bg-white/5"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}