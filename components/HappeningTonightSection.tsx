import { happeningTonight } from "@/data/nightly";

export default function HappeningTonightSection() {
  return (
    <section id="live-tonight" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Live now</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Live Tonight</h2>
        </div>
        <button className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400/50 hover:text-white">
          See all
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {happeningTonight.map((event) => (
          <article key={event.id} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className={`relative h-36 bg-gradient-to-br ${event.imageClass}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_55%)]" />
              {event.badge ? (
                <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-100">
                  {event.badge}
                </span>
              ) : null}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-cyan-200">{event.genre}</p>
                <p className="text-sm text-zinc-400">{event.distance}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{event.event}</h3>
                <p className="mt-1 text-sm text-zinc-400">{event.venue}</p>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-300">
                <span>{event.time}</span>
                <span>{event.cover}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300">{event.crowd}</span>
                <button className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">Reserve</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
