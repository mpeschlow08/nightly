import { liveVibes } from "@/data/nightly";

export default function LiveVibeSection() {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-pink-300/80">Live now</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Live Vibe</h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {liveVibes.map((venue) => (
          <article key={venue.id} className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{venue.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">{venue.crowd}</p>
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                {venue.vibeScore}/100
              </span>
            </div>

            <div className="mt-5 space-y-2 text-sm text-zinc-300">
              <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2">
                <span>Genre</span>
                <span className="font-medium text-white">{venue.genre}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2">
                <span>Wait</span>
                <span className="font-medium text-white">{venue.wait}</span>
              </div>
            </div>

            <button className="mt-5 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
              Live preview
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
