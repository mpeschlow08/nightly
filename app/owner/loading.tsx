export default function OwnerLoading() {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-zinc-950/70 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Loading</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Loading owner portal</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
