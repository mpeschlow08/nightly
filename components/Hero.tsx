import Link from "next/link";

export default function Hero() {
  return (
    <section id="discover" className="mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_38%),radial-gradient(circle_at_82%_20%,_rgba(155,92,255,0.14),_transparent_34%),linear-gradient(145deg,_rgba(10,14,24,0.9),_rgba(5,8,14,0.92))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-cyan-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
          AI City Pulse • Atlanta
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-7xl">
          Your City Pulse for Tonight.
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
          Real-time neighborhood momentum, live venue energy, and events worth stepping out for, all tuned for Atlanta after dark.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/90">Momentum</p>
            <p className="mt-1 text-lg font-semibold text-white">Midtown +18%</p>
            <p className="mt-1 text-xs text-cyan-100/80">Fastest-rising check-ins</p>
          </div>
          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-violet-100/90">Live Density</p>
            <p className="mt-1 text-lg font-semibold text-white">14 venues active</p>
            <p className="mt-1 text-xs text-zinc-300">Peak energy expected by 11:30 PM</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-300">Recommendation</p>
            <p className="mt-1 text-lg font-semibold text-white">House + Afrobeats</p>
            <p className="mt-1 text-xs text-zinc-400">Best fit based on tonight&apos;s pulse</p>
          </div>
        </div>

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
            <Link href="/discover" className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-center text-sm font-medium text-white transition hover:opacity-90">
              Explore Tonight
            </Link>
            <Link href="#map" className="rounded-full border border-white/15 px-5 py-3 text-center text-sm font-medium text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
              View Live Map
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <span className="rounded-full bg-white/10 px-3 py-1">Pulse confidence: 92%</span>
          <span className="rounded-full bg-white/10 px-3 py-1">13 live updates</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Personalized for Atlanta</span>
        </div>
      </div>
    </section>
  );
}
