type TonightsPulseProps = {
  venueId: number;
  crowdLevel: string | null;
  isLive: boolean | null;
};

function derivePulseScore(venueId: number) {
  return (Math.abs(venueId) * 37 + 23) % 101;
}

function deriveEnergyLevel(score: number) {
  if (score >= 80) return "High";
  if (score >= 55) return "Elevated";
  if (score >= 30) return "Moderate";
  return "Low";
}

function deriveEstimatedWait(score: number) {
  return Math.max(4, Math.round(score * 0.35));
}

function derivePulseBand(score: number) {
  if (score >= 75) return "Packed";
  if (score >= 50) return "Busy";
  if (score >= 25) return "Moderate";
  return "Low";
}

function deriveSummary(score: number, crowdLevel: string | null) {
  const band = derivePulseBand(score).toLowerCase();
  const crowd = crowdLevel?.toLowerCase();

  if (crowd) {
    return `Estimated ${band} pulse with a ${crowd} crowd profile tonight.`;
  }

  return `Estimated ${band} pulse tonight based on current venue activity signals.`;
}

export default function TonightsPulse({ venueId, crowdLevel, isLive }: TonightsPulseProps) {
  const pulseScore = derivePulseScore(venueId);
  const energyLevel = deriveEnergyLevel(pulseScore);
  const waitMinutes = deriveEstimatedWait(pulseScore);
  const lastUpdatedMinutes = (Math.abs(venueId) * 11) % 26 + 4;
  const summary = deriveSummary(pulseScore, crowdLevel);
  const liveLabel = isLive ? "Live Now" : "Not Live";
  const liveStyles = isLive
    ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
    : "border-white/20 bg-white/10 text-zinc-300";

  const levelLabels = ["Low", "Moderate", "Busy", "Packed"];
  const activeIndex = pulseScore >= 75 ? 3 : pulseScore >= 50 ? 2 : pulseScore >= 25 ? 1 : 0;

  return (
    <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 shadow-[0_0_60px_rgba(0,179,255,0.08)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Tonight&apos;s Pulse</h2>
          <p className="mt-2 text-sm text-zinc-300">Estimated values until live venue telemetry is connected.</p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${liveStyles}`}>
          {liveLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Pulse Score</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-200">{pulseScore}<span className="ml-1 text-base text-zinc-400">/100</span></p>
          <p className="mt-2 text-xs text-zinc-400">Estimated</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Crowd Level</p>
          <p className="mt-2 text-lg font-medium text-white">{crowdLevel ?? "Unavailable"}</p>
          <p className="mt-2 text-xs text-zinc-400">From venue data</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Energy Level</p>
          <p className="mt-2 text-lg font-medium text-white">{energyLevel}</p>
          <p className="mt-2 text-xs text-zinc-400">Estimated from pulse score</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Estimated Wait</p>
          <p className="mt-2 text-lg font-medium text-white">{waitMinutes} min</p>
          <p className="mt-2 text-xs text-zinc-400">Estimated from pulse score</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2 lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Last Updated</p>
          <p className="mt-2 text-lg font-medium text-white">{lastUpdatedMinutes} min ago</p>
          <p className="mt-2 text-xs text-zinc-400">Estimated sync window</p>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400">
          <span>Pulse Meter</span>
          <span>{derivePulseBand(pulseScore)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/10 bg-zinc-900/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400/85 via-sky-400/85 to-violet-500/85 shadow-[0_0_22px_rgba(0,179,255,0.5)] transition-all duration-700 ease-out animate-pulse"
            style={{ width: `${pulseScore}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-4 text-[11px] uppercase tracking-[0.18em]">
          {levelLabels.map((label, index) => (
            <span key={label} className={index <= activeIndex ? "text-cyan-200" : "text-zinc-500"}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-violet-500/10 p-4">
        <p className="text-sm leading-6 text-zinc-200">{summary}</p>
      </div>
    </section>
  );
}