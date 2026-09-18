import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import type { ConsumerEventCard } from "@/lib/consumer/types";

type DiscoveryEventSectionProps = {
  title: string;
  href: string;
  items: ConsumerEventCard[];
  eyebrow?: string;
  subtitle?: string;
};

export default function DiscoveryEventSection({ title, href, items, eyebrow, subtitle }: DiscoveryEventSectionProps) {
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
        {items.map((event, index) => (
          <EventDiscoveryCard
            key={event.id}
            href={event.href}
            name={event.name}
            venueName={event.venueName}
            neighborhood={event.neighborhood}
            startTime={event.startTimeLabel}
            cover={event.cover}
            imageUrl={event.imageUrl}
            ticketStatus={event.ticketStatus}
            isLive={event.isLive}
            reason={event.recommendationReason}
            animationDelayMs={index * 45}
          />
        ))}
      </div>
    </section>
  );
}
