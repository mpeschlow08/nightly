import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { CalendarDays, CircleUserRound, Clapperboard } from "lucide-react";

import HomePhotoCard, { type HomePhotoItem } from "@/components/home/HomePhotoCard";
import { getHomeData } from "@/lib/consumer/data";
import type { ConsumerEventCard, ConsumerVenueCard } from "@/lib/consumer/types";

const FALLBACK_IMAGE_PATH = "/assets/nightly-fallback-";

function hasPhotographicImage(imageUrl: string | null | undefined) {
  return Boolean(imageUrl?.trim() && !imageUrl.includes(FALLBACK_IMAGE_PATH));
}

function crowdLabel(level: string | null) {
  if (level === "Packed") return "Very Busy";
  if (level === "Buzzing") return "Busy";
  if (level === "Steady") return "Steady";
  if (level === "Mellow") return "Mellow";
  return null;
}

function toVenuePhotoItem(venue: ConsumerVenueCard): HomePhotoItem {
  const isLive = venue.liveLabel === "EVENT LIVE" || venue.liveLabel === "CAMERA LIVE";
  return {
    id: `venue-${venue.id}`,
    kind: "venue",
    href: venue.href,
    name: venue.name,
    imageUrl: venue.thumbnailImageUrl || venue.heroImageUrl,
    imageAlt: `${venue.name} nightlife`,
    detail: venue.neighborhood,
    statusLabel: isLive ? "LIVE" : null,
    statusTone: isLive ? "live" : null,
    crowdLabel: crowdLabel(venue.crowdLevel),
    specialGuestTitle: venue.specialGuestHighlight?.title ?? null,
  };
}

function toEventPhotoItem(event: ConsumerEventCard): HomePhotoItem {
  return {
    id: `event-${event.id}`,
    kind: "event",
    href: event.href,
    name: event.name,
    imageUrl: event.imageUrl,
    imageAlt: `${event.name} event at ${event.venueName}`,
    detail: [event.venueName, event.startTimeLabel].filter(Boolean).join(" · "),
    statusLabel: event.isLive ? "LIVE" : "TONIGHT",
    statusTone: event.isLive ? "live" : "violet",
    crowdLabel: crowdLabel(event.crowdLevel),
    specialGuestTitle: event.specialGuestHighlight?.title ?? null,
  };
}

function HomeMobile({
  displayName,
  isSignedIn,
  items,
  liveAvailable,
  eventAvailable,
}: {
  displayName: string | null;
  isSignedIn: boolean;
  items: HomePhotoItem[];
  liveAvailable: boolean;
  eventAvailable: boolean;
}) {
  const [primary, secondary, ...more] = items;

  return (
    <section className="home-mobile mx-auto w-full px-4 pb-8 pt-[max(10px,env(safe-area-inset-top))] md:hidden" aria-label="Nightly tonight">
      <header className="mb-3 flex min-h-10 items-center justify-between gap-3">
        <p className="min-w-0 text-[15px] font-semibold leading-[1.12] text-white">
          <span className="block">Good evening,</span>
          <span className="mt-0.5 block">{displayName ?? "Atlanta"} <span aria-hidden="true">👋</span></span>
        </p>
        <Link
          href={isSignedIn ? "/profile" : "/sign-in"}
          prefetch={false}
          aria-label={isSignedIn ? "Open profile" : "Sign in"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#111019] text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
        >
          <CircleUserRound size={18} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </header>

      <div className="mb-2.5 flex min-h-7 items-center justify-between gap-3">
        <h1 className="text-[19px] font-semibold leading-tight text-white">Tonight in Atlanta</h1>
        {liveAvailable ? (
          <Link href="/live" prefetch={false} className="shrink-0 text-[11px] font-semibold text-rose-200">Live now</Link>
        ) : eventAvailable ? (
          <Link href="/events" className="shrink-0 text-[11px] font-medium text-violet-200">Events</Link>
        ) : null}
      </div>

      {primary ? (
        <div className="grid gap-2.5">
          <HomePhotoCard item={primary} priority className="home-mobile-photo aspect-[1.45]" />
          {secondary ? <HomePhotoCard item={secondary} className="home-mobile-photo aspect-[1.45]" /> : null}
        </div>
      ) : (
        <Link href="/discover" className="flex aspect-[1.72] items-end rounded-[15px] border border-white/10 bg-[#100d18] p-4 text-sm text-white">
          Tonight is still taking shape. <span className="ml-1 text-violet-200">Explore Atlanta →</span>
        </Link>
      )}

      {more.length > 0 ? (
        <section className="mt-5" aria-labelledby="mobile-more-tonight">
          <h2 id="mobile-more-tonight" className="mb-2.5 text-sm font-semibold text-white">More tonight</h2>
          <div className="grid gap-2.5">
            {more.slice(0, 3).map((item) => <HomePhotoCard key={item.id} item={item} className="home-mobile-photo aspect-[1.9]" />)}
          </div>
        </section>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/live" prefetch={false} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#100d18] text-[11px] font-medium text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70">
          <Clapperboard size={15} strokeWidth={1.8} aria-hidden="true" />
          Hot Reels
        </Link>
        {eventAvailable ? (
          <Link href="/events" className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#100d18] text-[11px] font-medium text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70">
            <CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />
            Events
          </Link>
        ) : (
          <Link href="/discover" className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#100d18] text-[11px] font-medium text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70">
            <CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />
            Explore
          </Link>
        )}
      </div>
    </section>
  );
}

function HomeTablet({
  displayName,
  isSignedIn,
  items,
  liveAvailable,
  eventAvailable,
}: {
  displayName: string | null;
  isSignedIn: boolean;
  items: HomePhotoItem[];
  liveAvailable: boolean;
  eventAvailable: boolean;
}) {
  const [primary, secondary, ...more] = items;

  return (
    <section className="home-tablet mx-auto hidden w-full max-w-[980px] px-6 pb-10 pt-[max(20px,env(safe-area-inset-top))] md:block lg:hidden" aria-label="Nightly tonight">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-white">Good evening{displayName ? `, ${displayName}` : ""} <span aria-hidden="true">👋</span></p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-white">Tonight in Atlanta</h1>
        </div>
        <Link href={isSignedIn ? "/profile" : "/sign-in"} prefetch={false} aria-label={isSignedIn ? "Open profile" : "Sign in"} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#111019] text-violet-100">
          <CircleUserRound size={19} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </header>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-white/55">Atlanta · Tonight</p>
        <div className="flex gap-4 text-xs font-medium">
          {liveAvailable ? <Link href="/live" prefetch={false} className="text-rose-200">Live now</Link> : null}
          {eventAvailable ? <Link href="/events" className="text-violet-200">Events</Link> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {primary ? <HomePhotoCard item={primary} priority className="aspect-[1.18]" /> : null}
        {secondary ? <HomePhotoCard item={secondary} className="aspect-[1.18]" /> : null}
      </div>
      {more.length ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {more.slice(0, 3).map((item) => <HomePhotoCard key={item.id} item={item} className="aspect-[1.35]" />)}
        </div>
      ) : null}
    </section>
  );
}

function HomeDesktop({
  displayName,
  items,
  liveAvailable,
  eventAvailable,
}: {
  displayName: string | null;
  items: HomePhotoItem[];
  liveAvailable: boolean;
  eventAvailable: boolean;
}) {
  const [primary, secondary, ...more] = items;

  return (
    <section className="home-desktop mx-auto hidden w-full max-w-[1240px] grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] gap-5 px-8 pb-12 pt-6 lg:grid" aria-label="Nightly tonight">
      <div>
        <p className="text-sm font-medium text-white/65">Good evening{displayName ? `, ${displayName}` : ""}</p>
        <div className="mb-3 mt-1 flex items-center justify-between gap-4">
          <h1 className="text-[25px] font-semibold leading-tight text-white">Tonight in Atlanta</h1>
          <div className="flex shrink-0 gap-4 text-xs font-medium">
            {liveAvailable ? <Link href="/live" prefetch={false} className="text-rose-200">Live now</Link> : null}
            {eventAvailable ? <Link href="/events" className="text-violet-200">Events</Link> : null}
          </div>
        </div>
        {primary ? <HomePhotoCard item={primary} priority className="aspect-[1.08]" /> : null}
      </div>
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-white/55">Around Atlanta tonight</p>
        {secondary ? <HomePhotoCard item={secondary} className="aspect-[1.62]" /> : null}
        {more.slice(0, 2).map((item) => <HomePhotoCard key={item.id} item={item} className="aspect-[1.62]" />)}
        {items.length === 0 ? <Link href="/discover" className="text-sm text-violet-200">Explore Atlanta tonight →</Link> : null}
      </div>
    </section>
  );
}

export default async function ConsumerHomePage() {
  const [homeData, user] = await Promise.all([getHomeData(), currentUser()]);
  const displayName = user?.firstName?.trim() || user?.fullName?.trim().split(/\s+/)[0] || null;
  const venues = [...homeData.tonightTopPicks, ...homeData.liveTonight, ...homeData.popularNearby, ...homeData.trending, ...homeData.recommended]
    .filter((venue, index, all) => all.findIndex((candidate) => candidate.id === venue.id) === index);
  const events = [...homeData.eventsStartingSoon, ...homeData.eventsTonight]
    .filter((event, index, all) => all.findIndex((candidate) => candidate.id === event.id) === index);

  const photoVenues = venues.filter((venue) => hasPhotographicImage(venue.thumbnailImageUrl || venue.heroImageUrl));
  const photoEvents = events.filter((event) => hasPhotographicImage(event.imageUrl));
  const primaryVenue = photoVenues[0] ?? venues[0] ?? null;
  const secondaryVenue = photoVenues[1] ?? venues.find((venue) => venue.id !== primaryVenue?.id) ?? null;
  const leadItems = [
    primaryVenue ? toVenuePhotoItem(primaryVenue) : null,
    photoVenues[1]
      ? toVenuePhotoItem(photoVenues[1])
      : photoEvents[0]
        ? toEventPhotoItem(photoEvents[0])
        : secondaryVenue
          ? toVenuePhotoItem(secondaryVenue)
          : null,
  ].filter((item): item is HomePhotoItem => item !== null);
  const usedItemIds = new Set(leadItems.map((item) => item.id));
  const photoItems = [
    ...leadItems,
    ...photoVenues.filter((venue) => !usedItemIds.has(`venue-${venue.id}`)).slice(0, 2).map(toVenuePhotoItem),
    ...photoEvents.filter((event) => !usedItemIds.has(`event-${event.id}`)).slice(0, 2).map(toEventPhotoItem),
  ];
  const liveAvailable = homeData.liveTonight.some((venue) => venue.liveLabel === "EVENT LIVE" || venue.liveLabel === "CAMERA LIVE");
  const isSignedIn = Boolean(user);

  return (
    <div className="nightly-page nightly-page-shell nightly-home">
      <HomeMobile displayName={displayName} isSignedIn={isSignedIn} items={photoItems} liveAvailable={liveAvailable} eventAvailable={events.length > 0} />
      <HomeTablet displayName={displayName} isSignedIn={isSignedIn} items={photoItems} liveAvailable={liveAvailable} eventAvailable={events.length > 0} />
      <HomeDesktop displayName={displayName} items={photoItems} liveAvailable={liveAvailable} eventAvailable={events.length > 0} />
    </div>
  );
}