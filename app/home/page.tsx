import Hero from "@/components/Hero";
import TrendingVenuesSection from "@/components/TrendingVenuesSection";
import HappeningTonightSection from "@/components/HappeningTonightSection";
import EventsTonightSection from "@/components/EventsTonightSection";
import PopularNearYouSection from "@/components/PopularNearYouSection";
import LiveVibeSection from "@/components/LiveVibeSection";
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
          <HappeningTonightSection liveTonight={homeData.liveTonight ?? []} />
          <TrendingVenuesSection trendingVenues={homeData.trending ?? []} />
          <EventsTonightSection tonightEvents={homeData.eventsTonight ?? []} />
          <PopularNearYouSection venueCards={homeData.popularNearby ?? []} />
          <LiveVibeSection recommendedVenues={homeData.recommended ?? []} />
        </main>
      </div>
    </div>
  );
}
