import Hero from "@/components/Hero";
import TrendingVenuesSection from "@/components/TrendingVenuesSection";
import HappeningTonightSection from "@/components/HappeningTonightSection";
import EventsTonightSection from "@/components/EventsTonightSection";
import PopularNearYouSection from "@/components/PopularNearYouSection";
import LiveVibeSection from "@/components/LiveVibeSection";
import DiscoveryVenueSection from "@/components/home/DiscoveryVenueSection";
import DiscoveryEventSection from "@/components/home/DiscoveryEventSection";
import NeighborhoodDiscoverySection from "@/components/home/NeighborhoodDiscoverySection";
import { getHomeData } from "@/lib/consumer/data";

export default async function ConsumerHomePage() {
  const homeData = await getHomeData();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.16),_transparent_32%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_24%)]" />

        <main className="pb-24">
          <Hero
            greeting={homeData.heroSummary.greeting}
            title={homeData.heroSummary.title}
            subtitle={homeData.heroSummary.subtitle}
          />
          <DiscoveryVenueSection title="Tonight's Top Picks" href="/discover" items={homeData.tonightTopPicks ?? []} />
          <HappeningTonightSection liveTonight={homeData.liveTonight ?? []} />
          <DiscoveryEventSection title="Events Starting Soon" href="/events" items={homeData.eventsStartingSoon ?? []} />
          <TrendingVenuesSection trendingVenues={homeData.trending ?? []} />
          <EventsTonightSection tonightEvents={homeData.eventsTonight ?? []} />
          <PopularNearYouSection venueCards={homeData.popularNearby ?? []} />
          <DiscoveryVenueSection title="Your Vibe" href="/discover" items={homeData.vibeForYou ?? []} />
          <DiscoveryVenueSection title="Friends Are Interested" href="/crews" items={homeData.friendsInterestedVenues ?? []} />
          <DiscoveryEventSection title="Friends and Events" href="/events" items={homeData.friendsInterestedEvents ?? []} />
          <NeighborhoodDiscoverySection title="Trending Neighborhoods" items={homeData.trendingNeighborhoods ?? []} />
          {homeData.cityPulse ? (
            <section className="mx-auto mt-7 max-w-3xl px-4 sm:px-5 lg:px-6">
              <div className="rounded-[1.25rem] border border-white/10 bg-[#060a14] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">AI City Pulse</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{homeData.cityPulse.headline}</h2>
                <p className="mt-2 text-sm text-zinc-300">{homeData.cityPulse.summary}</p>
              </div>
            </section>
          ) : null}
          <LiveVibeSection recommendedVenues={homeData.recommended ?? []} />
        </main>
      </div>
    </div>
  );
}
