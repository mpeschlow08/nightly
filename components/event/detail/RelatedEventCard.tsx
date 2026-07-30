import Link from "next/link";

import EventImage from "@/components/media/EventImage";

type RelatedEventCardProps = {
  href: string;
  imageUrl: string;
  title: string;
  venue: string;
  dateLabel: string;
  genre: string;
};

export default function RelatedEventCard({ href, imageUrl, title, venue, dateLabel, genre }: RelatedEventCardProps) {
  return (
    <Link href={href} className="nightly-card nightly-card-interactive min-h-[14.8rem] min-w-[15rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#060a14] shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
      <div className="relative">
        <EventImage src={imageUrl} alt={`${title} artwork`} orientation="portrait" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/18 to-transparent" />
      </div>
      <div className="space-y-1.5 p-3.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">{dateLabel}</p>
        <h3 className="line-clamp-1 text-sm font-semibold text-white">{title}</h3>
        <p className="line-clamp-1 text-xs text-zinc-400">{venue}</p>
        <p className="text-xs text-zinc-400">{genre}</p>
      </div>
    </Link>
  );
}
