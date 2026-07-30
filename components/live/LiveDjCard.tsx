import Link from "next/link";

import DJImage from "@/components/media/DJImage";
import type { ConsumerDJCard } from "@/lib/consumer/types";

type Props = {
  dj: ConsumerDJCard;
};

export default function LiveDjCard({ dj }: Props) {
  return (
    <article className="nightly-card nightly-card-interactive min-w-[16.2rem] snap-start overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/[0.04]">
      <DJImage src={dj.imageUrl} alt={`${dj.name} photo`} className="rounded-none" />
      <div className="space-y-1.5 p-3.5">
        <p className="truncate text-sm font-semibold text-white">{dj.name}</p>
        <p className="truncate text-xs text-zinc-300">{dj.genres[0] ?? "Open Format"}</p>
        <p className="truncate text-xs text-zinc-400">{dj.performingAt ?? "Atlanta"}</p>
      </div>
      <div className="px-3.5 pb-3.5">
        <Link
          href={dj.profileHref}
          className="nightly-btn-secondary inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/20 bg-black/25 px-3 text-xs font-semibold text-zinc-100"
        >
          View Profile
        </Link>
      </div>
    </article>
  );
}
