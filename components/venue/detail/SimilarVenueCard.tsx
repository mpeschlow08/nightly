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
    <Link href={href} className="nightly-card nightly-card-interactive min-h-[14.8rem] min-w-[14.8rem] snap-start overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#060a14] shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
      <div className="relative">
        <VenueImage src={imageUrl} alt={`${name} venue`} orientation="horizontal" className="rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/18 to-transparent" />
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-white">{name}</h3>
        <p className="text-xs text-zinc-400">{genre}</p>
        <p className="text-xs text-zinc-400">{distance}</p>
      </div>
    </Link>
  );
}
