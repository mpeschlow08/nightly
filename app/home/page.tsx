import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import Hero from "@/components/Hero";
import { getHomeData } from "@/lib/consumer/data";

export default async function ConsumerHomePage() {
  const [homeData, user] = await Promise.all([getHomeData(), currentUser()]);
  const displayName = user?.firstName?.trim() || user?.fullName?.trim().split(/\s+/)[0] || null;
  const featuredVenue = homeData.tonightTopPicks[0] ?? homeData.liveTonight[0] ?? homeData.trending[0] ?? null;
  const nearbyVenues = [...homeData.liveTonight, ...homeData.tonightTopPicks, ...homeData.popularNearby, ...homeData.trending]
    .filter((venue, index, all) => venue.id !== featuredVenue?.id && all.findIndex((candidate) => candidate.id === venue.id) === index)
    .slice(0, 3);
  const upcomingEvents = [...homeData.eventsStartingSoon, ...homeData.eventsTonight]
    .filter((event, index, all) => all.findIndex((candidate) => candidate.id === event.id) === index)
    .slice(0, 2);
  const hasLiveVenue = homeData.liveTonight.some((venue) => venue.liveLabel === "EVENT LIVE" || venue.liveLabel === "CAMERA LIVE");

  return (
    <div className="nightly-page nightly-page-shell nightly-home">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-32 sm:px-5 lg:px-8 lg:pb-12">
        <Hero
          displayName={displayName}
          featuredVenue={featuredVenue ? {
            name: featuredVenue.name,
            href: featuredVenue.href,
            imageUrl: featuredVenue.thumbnailImageUrl || featuredVenue.heroImageUrl,
            neighborhood: featuredVenue.neighborhood,
            genre: featuredVenue.genre,
            crowdLevel: featuredVenue.crowdLevel,
            liveLabel: featuredVenue.liveLabel,
            specialGuestTitle: featuredVenue.specialGuestHighlight?.title,
          } : null}
        />

        <section className="mx-auto mt-7 max-w-[760px]" aria-labelledby="more-tonight-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="more-tonight-heading" className="text-lg font-semibold text-white">More tonight</h2>
            <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
              {hasLiveVenue ? (
                <Link href="/live" className="text-rose-200 hover:text-white">Live now</Link>
              ) : null}
              {upcomingEvents.length > 0 ? (
                <Link href="/events" className="text-[color:var(--text-secondary)] hover:text-white">Events</Link>
              ) : null}
            </div>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
            {nearbyVenues.map((venue, index) => (
              <VenueDiscoveryCard key={`home-venue-${venue.id}`} venue={venue} variant="compact" animationDelayMs={index * 45} />
            ))}
            {upcomingEvents.map((event, index) => (
              <EventDiscoveryCard
                key={`home-event-${event.id}`}
                href={event.href}
                name={event.name}
                venueName={event.venueName}
                neighborhood={event.neighborhood}
                startTime={event.startTimeLabel}
                cover={event.cover}
                ticketStatus={event.ticketStatus}
                imageUrl={event.imageUrl}
                isLive={event.isLive}
                specialGuestHighlight={event.specialGuestHighlight}
                variant="compact"
                animationDelayMs={(nearbyVenues.length + index) * 45}
              />
            ))}
            {nearbyVenues.length === 0 && upcomingEvents.length === 0 ? (
              <Link href="/discover" className="flex min-h-36 w-full items-center justify-between rounded-xl border border-white/10 bg-[#100d18] px-4 py-4 text-sm text-[color:var(--text-secondary)] hover:border-violet-300/40">
                <span>More nightlife picks are on Explore.</span>
                <span aria-hidden="true" className="text-lg text-violet-200">→</span>
              </Link>
            ) : null}
          </div>

          <Link href="/concierge" className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--text-muted)] hover:text-white">
            Need a plan? <span className="font-medium text-violet-200">Ask Concierge <span aria-hidden="true">→</span></span>
          </Link>
        </section>
      </div>
    </div>
  );
}
