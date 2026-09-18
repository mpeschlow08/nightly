import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import type { ConsumerVenueCard } from "@/lib/consumer/types";

type Props = {
  venueCards: ConsumerVenueCard[];
};

export default function PopularNearYouSection({ venueCards }: Props) {

  return (
    <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
      <NightlySectionHeader
        eyebrow="Near You"
        title="Popular Near You"
        subtitle="Strong momentum in your side of the city."
        href="/discover"
      />

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8 [scrollbar-width:none]">
        {venueCards.map((venue, index) => (
          <VenueDiscoveryCard key={venue.id} venue={venue} animationDelayMs={index * 45} />
        ))}
      </div>
    </section>
  );
}
