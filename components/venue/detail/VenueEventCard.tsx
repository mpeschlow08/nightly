import Link from "next/link";

import EventImage from "@/components/media/EventImage";

type VenueEventCardProps = {
  href: string;
  imageUrl: string;
  title: string;
  startTime: string;
  endTime: string;
  dj: string;
  ticketStatus: string;
};

export default function VenueEventCard({
  href,
  imageUrl,
  title,
  startTime,
  endTime,
  dj,
  ticketStatus,
}: VenueEventCardProps) {
  return (
    <article className="nightly-card nightly-card-interactive min-h-[16.8rem] min-w-[15.8rem] snap-start overflow-hidden rounded-[1.2rem]">
      <div className="relative">
        <EventImage src={imageUrl} alt={`${title} artwork`} orientation="portrait" className="rounded-none" />
        <div className="nightly-image-overlay absolute inset-0" />
      </div>
      <div className="space-y-2.5 p-3.5">
        <h3 className="line-clamp-1 text-base font-semibold text-[color:var(--text-primary)]">{title}</h3>
        <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)]">{startTime} - {endTime}</p>
        <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)]">DJ: {dj}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-[color:var(--border)] bg-white/5 px-2.5 py-1 text-[11px] text-[color:var(--text-secondary)]">{ticketStatus}</span>
          <Link href={href} className="nightly-btn-secondary rounded-full border border-violet-300/35 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100">
            View Event
          </Link>
        </div>
      </div>
    </article>
  );
}
