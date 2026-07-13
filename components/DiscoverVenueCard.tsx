import type { DiscoverVenue } from "@/data/nightly";

type DiscoverVenueCardProps = {
  venue: DiscoverVenue;
  isSaved: boolean;
  onToggleSave: () => void;
};

export default function DiscoverVenueCard({ venue, isSaved, onToggleSave }: DiscoverVenueCardProps) {
  const crowdTone =
    venue.crowdLevel === "Packed"
      ? "bg-rose-400"
      : venue.crowdLevel === "Buzzing"
        ? "bg-cyan-400"
        : venue.crowdLevel === "High"
          ? "bg-violet-400"
          : "bg-emerald-400";

  return (
    <article className="group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_24px_80px_rgba(0,0,0,0.36)]">
      <div className={`relative h-56 bg-gradient-to-br ${venue.imageClass}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_50%)]" />
        {venue.isLive ? (
          <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
            {venue.badge ?? "LIVE"}
          </div>
        ) : null}

        <div className="absolute right-4 top-4 flex gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            className="rounded-full border border-white/20 bg-black/35 px-3 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:text-cyan-200"
            aria-label={isSaved ? `Remove ${venue.name} from saved` : `Save ${venue.name}`}
          >
            {isSaved ? "♥" : "♡"}
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-black/35 px-3 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:text-cyan-200"
            aria-label={`Share ${venue.name}`}
          >
            ↗
          </button>
        </div>

        <div className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1 text-sm text-white backdrop-blur-sm">
          {venue.distanceMiles.toFixed(1)} mi away
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{venue.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">{venue.neighborhood}</p>
            <p className="mt-1 text-sm text-zinc-500">{venue.tagline}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-200">
            <span className={`h-2.5 w-2.5 rounded-full ${crowdTone} animate-pulse`} />
            {venue.crowdLevel}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {venue.genres.map((genre) => (
            <span key={genre} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200">
              {genre}
            </span>
          ))}
        </div>

        <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Live DJ</span>
            <span className="font-medium text-white">{venue.liveDjName}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Cover</span>
            <span className="font-medium text-white">${venue.cover}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Open until</span>
            <span className="font-medium text-white">{venue.openUntil}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Vibe score</span>
            <span className="font-medium text-white">{venue.vibeScore}/100</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Wait</span>
            <span className="font-medium text-white">{venue.waitTime}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Checked in</span>
            <span className="font-medium text-white">{venue.checkedIn}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-medium text-zinc-100 transition hover:border-cyan-400/40 hover:bg-white/10"
          >
            View Details
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-center text-sm font-medium text-white transition hover:opacity-90"
          >
            Share
          </button>
        </div>
      </div>
    </article>
  );
}
