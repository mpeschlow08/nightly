import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import type { ConsumerVenueCard } from "@/lib/consumer/types";

type DiscoveryVenueSectionProps = {
  title: string;
  href: string;
  items: ConsumerVenueCard[];
  eyebrow?: string;
  subtitle?: string;
};

export default function DiscoveryVenueSection({ title, href, items, eyebrow, subtitle }: DiscoveryVenueSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
      <NightlySectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        href={href}
      />

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8 [scrollbar-width:none]">
        {items.map((venue, index) => (
          <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
        ))}
      </div>
    </section>
  );
}
