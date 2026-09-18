import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import type { ConsumerVenueCard } from "@/lib/consumer/types";

type Props = {
  liveTonight: ConsumerVenueCard[];
};

export default function HappeningTonightSection({ liveTonight }: Props) {

  return (
    <section id="live-tonight" className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
      <NightlySectionHeader
        eyebrow="Live Now"
        title="On Air Tonight"
        subtitle="Streaming and active venue floors happening now."
        href="/live"
      />

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8 [scrollbar-width:none]">
        {liveTonight.map((venue, index) => (
          <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
        ))}
      </div>
    </section>
  );
}
