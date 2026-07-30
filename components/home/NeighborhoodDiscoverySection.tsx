import Link from "next/link";

import NightlyImage from "@/components/media/NightlyImage";

type NeighborhoodItem = {
  id: string;
  name: string;
  summary: string;
  imageUrl: string;
  href: string;
};

type NeighborhoodDiscoverySectionProps = {
  title: string;
  items: NeighborhoodItem[];
};

export default function NeighborhoodDiscoverySection({ title, items }: NeighborhoodDiscoverySectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-7 max-w-3xl px-4 sm:px-5 lg:px-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <Link href="/discover" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-300">
          See All
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:none]">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="nightly-card nightly-card-interactive relative min-h-[18.8rem] min-w-[17.2rem] snap-start overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#050912] shadow-[0_20px_54px_rgba(0,0,0,0.42)]"
          >
            <NightlyImage src={item.imageUrl} alt={`${item.name} nightlife`} ratio="portrait" sizes="(max-width: 640px) 80vw, 280px" className="rounded-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/28 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <h3 className="text-base font-semibold text-white">{item.name}</h3>
              <p className="mt-1 text-xs text-zinc-300">{item.summary}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
