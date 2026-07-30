import Link from "next/link";

import DJImage from "@/components/media/DJImage";
import type { ConsumerDJCard } from "@/lib/consumer/types";

type ExploreDjCardProps = {
  dj: ConsumerDJCard;
  animationDelayMs?: number;
};

export default function ExploreDjCard({ dj, animationDelayMs = 0 }: ExploreDjCardProps) {
  return (
    <article
      className="nightly-card nightly-card-interactive nightly-fade-in min-h-[16.8rem] min-w-[15.2rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#060a14] shadow-[0_18px_48px_rgba(0,0,0,0.36)] active:scale-[0.99]"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="relative overflow-hidden">
        <DJImage src={dj.imageUrl} alt={`${dj.name} portrait`} className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
        {dj.isPerformingTonight ? (
          <span className="absolute left-3 top-3 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-cyan-100">
            TONIGHT
          </span>
        ) : null}
      </div>
      <div className="space-y-2.5 p-3.5">
        <h3 className="text-base font-semibold text-white">{dj.name}</h3>
        <p className="line-clamp-1 text-xs text-zinc-400">{dj.genres.join(" • ")}</p>
        <p className="line-clamp-1 text-xs text-zinc-500">{dj.performingAt}</p>
        <Link
          href={dj.profileHref}
          className="nightly-btn-secondary inline-flex min-h-9 items-center rounded-full border border-white/15 bg-white/5 px-3 text-xs font-medium text-zinc-100"
        >
          View Profile
        </Link>
      </div>
    </article>
  );
}
