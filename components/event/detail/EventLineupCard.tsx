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
    <article className="nightly-card nightly-card-interactive min-h-[17rem] min-w-[15.6rem] snap-start overflow-hidden rounded-[1.2rem]">
      <div className="relative">
        <DJImage src={imageUrl} alt={`${name} performer`} className="rounded-none" />
        <div className="nightly-image-overlay absolute inset-0" />
      </div>
      <div className="space-y-2.5 p-3.5">
        <p className="text-[0.66rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Lineup</p>
        <h3 className="line-clamp-1 text-base font-semibold text-[color:var(--text-primary)]">{name}</h3>
        <p className="text-xs text-[color:var(--text-secondary)]">{genre}</p>
        <p className="text-xs text-[color:var(--text-secondary)]">Set time: {time}</p>
        <Link href={profileHref} className="nightly-btn-secondary inline-flex min-h-8 items-center rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-xs font-medium text-violet-100">
          View Profile
        </Link>
      </div>
    </article>
  );
}
