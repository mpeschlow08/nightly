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
    <Link href={href} className="nightly-card nightly-card-interactive min-h-[15rem] min-w-[15rem] snap-start overflow-hidden rounded-[1.2rem]">
      <div className="relative">
        <EventImage src={imageUrl} alt={`${title} artwork`} orientation="portrait" className="rounded-none" />
        <div className="nightly-image-overlay absolute inset-0" />
      </div>
      <div className="space-y-1.5 p-3.5">
        <p className="text-[0.66rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{dateLabel}</p>
        <h3 className="line-clamp-1 text-sm font-semibold text-[color:var(--text-primary)]">{title}</h3>
        <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)]">{venue}</p>
        <p className="text-xs text-[color:var(--text-secondary)]">{genre}</p>
      </div>
    </Link>
  );
}
