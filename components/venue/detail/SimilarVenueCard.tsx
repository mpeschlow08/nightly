import Link from "next/link";

import VenueImage from "@/components/media/VenueImage";

type SimilarVenueCardProps = {
  href: string;
  name: string;
  genre: string;
  distance: string;
  imageUrl: string;
};

export default function SimilarVenueCard({ href, name, genre, distance, imageUrl }: SimilarVenueCardProps) {
  return (
    <Link href={href} className="nightly-card nightly-card-interactive min-h-[14.8rem] min-w-[14.8rem] snap-start overflow-hidden rounded-[1.2rem]">
      <div className="relative">
        <VenueImage src={imageUrl} alt={`${name} venue`} orientation="horizontal" className="rounded-none" />
        <div className="nightly-image-overlay absolute inset-0" />
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-[color:var(--text-primary)]">{name}</h3>
        <p className="text-xs text-[color:var(--text-secondary)]">{genre}</p>
        <p className="text-xs text-[color:var(--text-secondary)]">{distance}</p>
      </div>
    </Link>
  );
}
