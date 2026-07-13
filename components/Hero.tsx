import Link from "next/link";

export default function Hero() {
  return (
    <section id="discover" className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-cyan-200">
          <span className="h-2 w-2 rounded-full bg-cyan-300" />
          Atlanta • Tonight
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-7xl">
          Find Your Vibe.
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
          Discover what is happening tonight, from intimate lounges to late-night headline sets, all tailored for the city after dark.
        </p>

        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-cyan-200">
              Atlanta, GA
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <input
              className="w-full bg-transparent outline-none placeholder:text-zinc-500"
              placeholder="Search venues, DJs, events, genres"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90">
              Explore Tonight
            </button>
            <Link href="#map" className="rounded-full border border-white/15 px-5 py-3 text-center text-sm font-medium text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
              View Live Map
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <span className="rounded-full bg-white/10 px-3 py-1">Tonight&apos;s energy: 92%</span>
          <span className="rounded-full bg-white/10 px-3 py-1">13 new drops</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Curated for Atlanta</span>
        </div>
      </div>
    </section>
  );
}
