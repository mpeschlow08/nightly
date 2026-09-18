import Hero from "@/components/Hero";
import TrendingVenuesSection from "@/components/TrendingVenuesSection";
import HappeningTonightSection from "@/components/HappeningTonightSection";
import EventsTonightSection from "@/components/EventsTonightSection";
import PopularNearYouSection from "@/components/PopularNearYouSection";
import LiveVibeSection from "@/components/LiveVibeSection";
import Link from "next/link";
import DiscoveryVenueSection from "@/components/home/DiscoveryVenueSection";
import DiscoveryEventSection from "@/components/home/DiscoveryEventSection";
import NeighborhoodDiscoverySection from "@/components/home/NeighborhoodDiscoverySection";
import NightlyEmptyState from "@/components/nightly/NightlyEmptyState";
import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import { getHomeData } from "@/lib/consumer/data";

export default async function ConsumerHomePage() {
  const homeData = await getHomeData();
  const specialGuestVenues = [...homeData.tonightTopPicks, ...homeData.trending, ...homeData.liveTonight]
    .filter((venue) => Boolean(venue.specialGuestHighlight))
    .filter((venue, index, all) => all.findIndex((candidate) => candidate.id === venue.id) === index)
    .slice(0, 8);

  const featuredVenue = homeData.tonightTopPicks[0] ?? homeData.liveTonight[0] ?? homeData.trending[0] ?? null;

  return (
    <div className="nightly-page">
      <div className="nightly-page-shell overflow-x-hidden">
        <main className="pb-28 lg:pb-10">
          <Hero
            greeting={homeData.heroSummary.greeting}
            title={homeData.heroSummary.title}
            subtitle={homeData.heroSummary.subtitle}
            featuredVenue={
              featuredVenue
                ? {
                    name: featuredVenue.name,
                    href: featuredVenue.href,
                    imageUrl: featuredVenue.thumbnailImageUrl || featuredVenue.heroImageUrl,
                    neighborhood: featuredVenue.neighborhood,
                    isLive: featuredVenue.isLive,
                    specialGuestTitle: featuredVenue.specialGuestHighlight?.title,
                    specialGuestBadge: featuredVenue.specialGuestHighlight?.badge,
                  }
                : null
            }
          />

          <DiscoveryVenueSection
            eyebrow="Tonight"
            title="Where To Go Tonight"
            subtitle="High-value picks with strong current momentum."
            href="/discover"
            items={homeData.tonightTopPicks ?? []}
          />

          <HappeningTonightSection liveTonight={homeData.liveTonight ?? []} />

          {specialGuestVenues.length > 0 ? (
            <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
              <NightlySectionHeader
                eyebrow="Exclusive"
                title="Special Guests Tonight"
                subtitle="Notable guests visible before you commit to a venue."
                href="/discover"
              />
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8 [scrollbar-width:none]">
                {specialGuestVenues.map((venue, index) => (
                  <VenueDiscoveryCard key={`special-guest-venue-${venue.id}`} venue={venue} animationDelayMs={index * 45} />
                ))}
              </div>
            </section>
          ) : null}

          <PopularNearYouSection venueCards={homeData.popularNearby ?? []} />
          <EventsTonightSection tonightEvents={homeData.eventsTonight ?? []} />
          <DiscoveryEventSection
            eyebrow="Starting Soon"
            title="Events Starting Soon"
            subtitle="Tonight's nearest start times so you can plan quickly."
            href="/events"
            items={homeData.eventsStartingSoon ?? []}
          />
          <DiscoveryVenueSection
            eyebrow="Your Vibe"
            title="For Your Vibe"
            subtitle="Personalized picks from your recent tastes and city pulse."
            href="/discover"
            items={homeData.vibeForYou ?? []}
          />
          <DiscoveryVenueSection
            eyebrow="Social Signals"
            title="Friends Are Interested"
            subtitle="Where your circle is leaning tonight."
            href="/crews"
            items={homeData.friendsInterestedVenues ?? []}
          />
          <DiscoveryEventSection
            eyebrow="Social Signals"
            title="Friends And Events"
            subtitle="Event activity from your network where data exists."
            href="/events"
            items={homeData.friendsInterestedEvents ?? []}
          />
          <TrendingVenuesSection trendingVenues={homeData.trending ?? []} />
          <NeighborhoodDiscoverySection
            eyebrow="Neighborhood Pulse"
            title="Trending Neighborhoods"
            subtitle="Zoom into districts with elevated nightlife energy."
            items={homeData.trendingNeighborhoods ?? []}
          />

          {homeData.cityPulse ? (
            <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
              <div className="nightly-surface-elevated p-5 sm:p-6">
                <p className="text-[0.66rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">AI City Pulse</p>
                <h2 className="nightly-section-title mt-1">{homeData.cityPulse.headline}</h2>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{homeData.cityPulse.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/concierge"
                    className="nightly-btn-primary rounded-full border border-transparent bg-gradient-to-r from-sky-400 to-violet-500 px-4 py-2 text-xs font-medium text-white"
                  >
                    Ask concierge
                  </Link>
                  <Link
                    href="/discover"
                    className="nightly-btn-secondary rounded-full border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs font-medium text-[color:var(--text-secondary)]"
                  >
                    Explore the city
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <LiveVibeSection recommendedVenues={homeData.recommended ?? []} />

          {homeData.tonightTopPicks.length === 0 && homeData.eventsTonight.length === 0 ? (
            <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-5 lg:px-8">
              <NightlyEmptyState
                eyebrow="Tonight"
                title="Night is still warming up"
                description="We do not have enough live nightlife data to make strong recommendations yet. Open Discover to browse all available venues and events."
                primaryAction={{ label: "Open Discover", href: "/discover" }}
                secondaryAction={undefined}
              />
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
