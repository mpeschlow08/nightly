import Link from "next/link";

import DJImage from "@/components/media/DJImage";

type VenueDjCardProps = {
  name: string;
  genres: string[];
  imageUrl: string;
  profileHref: string;
};

export default function VenueDjCard({ name, genres, imageUrl, profileHref }: VenueDjCardProps) {
  return (
    <article className="nightly-card nightly-card-interactive min-h-[16.8rem] min-w-[15.8rem] snap-start overflow-hidden rounded-[1.2rem]">
      <div className="relative">
        <DJImage src={imageUrl} alt={`${name} portrait`} className="rounded-none" />
        <div className="nightly-image-overlay absolute inset-0" />
      </div>
      <div className="space-y-2.5 p-3.5">
        <h3 className="line-clamp-1 text-base font-semibold text-[color:var(--text-primary)]">{name}</h3>
        <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)]">{genres.join(" • ")}</p>
        <div className="flex items-center gap-2">
          <button type="button" className="nightly-btn-secondary min-h-8 rounded-full border border-white/15 bg-white/5 px-3 text-xs text-[color:var(--text-secondary)]">
            Sample Mix
          </button>
          <Link href={profileHref} className="nightly-btn-secondary min-h-8 rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-xs font-medium text-violet-100">
            View Profile
          </Link>
        </div>
      </div>
    </article>
  );
}
