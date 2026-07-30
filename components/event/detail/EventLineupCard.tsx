import Link from "next/link";

import DJImage from "@/components/media/DJImage";

type EventLineupCardProps = {
  imageUrl: string;
  name: string;
  genre: string;
  time: string;
  profileHref: string;
};

export default function EventLineupCard({ imageUrl, name, genre, time, profileHref }: EventLineupCardProps) {
  return (
    <article className="nightly-card nightly-card-interactive min-h-[16.8rem] min-w-[15.4rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#060a14] shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
      <div className="relative">
        <DJImage src={imageUrl} alt={`${name} performer`} className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/20 to-transparent" />
      </div>
      <div className="space-y-2.5 p-3.5">
        <h3 className="line-clamp-1 text-base font-semibold text-white">{name}</h3>
        <p className="text-xs text-zinc-400">{genre}</p>
        <p className="text-xs text-zinc-400">Set time: {time}</p>
        <Link href={profileHref} className="nightly-btn-secondary inline-flex min-h-8 items-center rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-xs font-medium text-violet-100">
          View Profile
        </Link>
      </div>
    </article>
  );
}
