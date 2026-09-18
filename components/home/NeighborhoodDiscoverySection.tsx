import Link from "next/link";

import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
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
  eyebrow?: string;
  subtitle?: string;
};

export default function NeighborhoodDiscoverySection({ title, items, eyebrow, subtitle }: NeighborhoodDiscoverySectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
      <NightlySectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        href="/discover"
      />

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8 [scrollbar-width:none]">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="nightly-card nightly-card-interactive relative min-h-[18.8rem] min-w-[17.2rem] snap-start overflow-hidden rounded-[1.25rem]"
          >
            <NightlyImage src={item.imageUrl} alt={`${item.name} nightlife`} ratio="portrait" sizes="(max-width: 640px) 80vw, 280px" className="rounded-none" />
            <div className="nightly-image-overlay absolute inset-0" />
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
