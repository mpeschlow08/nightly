type RouteLoadingShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  metricCount?: number;
  cardCount?: number;
  listCount?: number;
};

function SkeletonPulse({ className, delayMs }: { className: string; delayMs?: number }) {
  return (
    <div
      className={`${className} motion-safe:animate-pulse`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    />
  );
}

export function RouteLoadingShell({
  eyebrow,
  title,
  subtitle,
  metricCount = 3,
  cardCount = 6,
  listCount = 4,
}: RouteLoadingShellProps) {
  const metrics = Array.from({ length: metricCount }, (_, index) => index);
  const cards = Array.from({ length: cardCount }, (_, index) => index);
  const rows = Array.from({ length: listCount }, (_, index) => index);

  return (
    <div className="min-h-[60vh] rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_42%),radial-gradient(circle_at_88%_8%,_rgba(167,139,250,0.12),_transparent_30%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#0d1322_100%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/80">{eyebrow}</p>
        <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-zinc-300 sm:text-base">{subtitle}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((index) => (
          <div
            key={`metric-${index}`}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <SkeletonPulse className="h-3 w-20 rounded bg-white/15" delayMs={90 * index} />
            <SkeletonPulse className="mt-3 h-7 w-24 rounded-md bg-cyan-300/20" delayMs={120 + 90 * index} />
            <SkeletonPulse className="mt-3 h-2 w-full rounded bg-white/10" delayMs={160 + 90 * index} />
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {cards.map((index) => (
          <div
            key={`card-${index}`}
            className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
          >
            <SkeletonPulse className="h-36 rounded-xl bg-white/10" delayMs={70 * index} />
            <SkeletonPulse className="mt-4 h-4 w-40 rounded bg-white/15" delayMs={90 + 70 * index} />
            <SkeletonPulse className="mt-2 h-3 w-5/6 rounded bg-white/10" delayMs={110 + 70 * index} />
            <SkeletonPulse className="mt-2 h-3 w-2/3 rounded bg-white/10" delayMs={130 + 70 * index} />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <SkeletonPulse className="h-4 w-36 rounded bg-white/15" />
        <div className="mt-4 space-y-3">
          {rows.map((index) => (
            <div key={`row-${index}`} className="flex items-center gap-3">
              <SkeletonPulse className="h-9 w-9 shrink-0 rounded-full bg-cyan-300/20" delayMs={100 * index} />
              <div className="min-w-0 flex-1">
                <SkeletonPulse className="h-3 w-1/2 rounded bg-white/15" delayMs={60 + 100 * index} />
                <SkeletonPulse className="mt-2 h-2.5 w-3/4 rounded bg-white/10" delayMs={90 + 100 * index} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}