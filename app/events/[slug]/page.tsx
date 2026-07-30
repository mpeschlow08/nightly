import Link from "next/link";
import { notFound } from "next/navigation";

import EventGallery from "@/components/event/detail/EventGallery";
import EventLineupCard from "@/components/event/detail/EventLineupCard";
import EventSectionHeading from "@/components/event/detail/EventSectionHeading";
import RelatedEventCard from "@/components/event/detail/RelatedEventCard";
import HeroImage from "@/components/media/HeroImage";
import VenueImage from "@/components/media/VenueImage";
import { activeTonight, getFriendById } from "@/data/link-up";
import {
  getEventBySlug,
  getUpcomingEvents,
  getVenueBySlug,
} from "@/lib/consumer/data";

type EventDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function profilePathFromName(name: string) {
  return `/dj/profile/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function fallbackLineup(eventTitle: string) {
  return [
    { name: `${eventTitle} Resident`, time: "11:00 PM" },
    { name: "Guest Set", time: "12:30 AM" },
    { name: "Late Night Closer", time: "2:00 AM" },
  ];
}

function friendPulseForVenue(venueName: string) {
  const normalized = venueName.toLowerCase().trim();
  const attending = activeTonight
    .filter((item) => item.venue.toLowerCase().trim() === normalized)
    .map((item) => getFriendById(item.friendId)?.displayName)
    .filter((item): item is string => Boolean(item));

  return {
    attending,
    interested: attending.length > 0 ? attending.slice(0, 2) : [],
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const [venuePreview, upcomingEvents] = await Promise.all([
    getVenueBySlug(event.venueSlug),
    getUpcomingEvents(60),
  ]);

  const relatedEvents = upcomingEvents
    .filter((item) => item.id !== event.id)
    .filter((item) => item.venueId === event.venueId || item.neighborhood === event.neighborhood)
    .slice(0, 8);

  const lineup = fallbackLineup(event.title);
  const heroImage = event.artworkImageUrl;
  const galleryImages = [event.artworkImageUrl, venuePreview?.heroImageUrl, venuePreview?.thumbnailImageUrl]
    .filter((item): item is string => Boolean(item));

  const friendPulse = friendPulseForVenue(event.venueName);

  const guestListStatus = event.guestListUrl ? "Guest list available" : "Guest list not available";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(24,48,118,0.22),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(147,51,234,0.22),_transparent_24%)]" />

        <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-3 sm:px-5 lg:px-6">
          <section className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#060a14] shadow-[0_26px_64px_rgba(0,0,0,0.46)]">
            <div className="relative">
              <HeroImage src={heroImage} alt={`${event.title} hero`} className="rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/46 to-black/18" />

              <div className="absolute right-3 top-3 flex items-center gap-2">
                <button type="button" className="nightly-btn-secondary min-h-9 rounded-full border border-white/20 bg-black/35 px-3 text-xs text-zinc-100">
                  Favorite
                </button>
                <button type="button" className="nightly-btn-secondary min-h-9 rounded-full border border-white/20 bg-black/35 px-3 text-xs text-zinc-100">
                  Share
                </button>
              </div>

              <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:p-5">
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.9rem]">{event.title}</h1>
                <p className="text-sm text-zinc-200">{event.venueName} • {event.dateLabel} • {event.neighborhood}</p>
                <div className="flex flex-wrap gap-2 text-[11px] text-zinc-100">
                  <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1">{event.startLabel}{event.endLabel ? ` - ${event.endLabel}` : ""}</span>
                  {event.ageRequirementLabel ? <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1">{event.ageRequirementLabel}</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4">
            <EventSectionHeading title="Event Summary" />
            <div className="grid gap-2 sm:grid-cols-2">
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Description</p>
                <p className="mt-1 text-sm text-zinc-200">{event.description ?? "Details will be shared by the venue soon."}</p>
              </article>
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Genres</p>
                <p className="mt-1 text-sm text-zinc-200">{event.genres.join(" • ")}</p>
              </article>
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Dress Code</p>
                <p className="mt-1 text-sm text-zinc-200">{event.dressCode ?? "Smart casual"}</p>
              </article>
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Cover</p>
                <p className="mt-1 text-sm text-zinc-200">{event.coverLabel}</p>
              </article>
              <article className="rounded-[1rem] border border-violet-300/30 bg-violet-500/12 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200">Guest List</p>
                <p className="mt-1 text-sm text-violet-100">{guestListStatus}</p>
              </article>
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Ticket Availability</p>
                <p className="mt-1 text-sm text-zinc-200">{event.ticketStatus}</p>
              </article>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-violet-300/35 bg-violet-500/20 px-3 text-sm font-medium text-violet-100">
              Buy Tickets
            </button>
            <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-sm font-medium text-violet-100">
              Join Guest List
            </button>
            <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-zinc-100">
              Add to Calendar
            </button>
            <a
              href={venuePreview?.googleMapsUrl ?? `https://maps.google.com/?q=${encodeURIComponent(`${event.venueName} ${event.neighborhood}`)}`}
              target="_blank"
              rel="noreferrer"
              className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-center text-sm text-zinc-100"
            >
              Get Directions
            </a>
            <button type="button" className="nightly-btn-secondary col-span-2 min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-zinc-100 sm:col-span-1">
              Share Event
            </button>
          </section>

          <section className="mt-7">
            <EventSectionHeading title="Lineup" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {lineup.map((act) => {
                return (
                  <EventLineupCard
                    key={act.name}
                    imageUrl={heroImage}
                    name={act.name}
                    genre={event.genres[0] ?? "Open Format"}
                    time={act.time}
                    profileHref={profilePathFromName(act.name)}
                  />
                );
              })}
            </div>
          </section>

          <section className="mt-7 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4">
            <EventSectionHeading title="Venue Preview" />
            <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-white/5">
              <div className="relative">
                <VenueImage src={venuePreview?.heroImageUrl ?? heroImage} alt={`${event.venueName} preview`} orientation="horizontal" className="rounded-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/20 to-transparent" />
              </div>
              <div className="space-y-2.5 p-3.5">
                <h3 className="text-base font-semibold text-white">{event.venueName}</h3>
                <p className="text-xs text-zinc-400">{event.neighborhood}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {venuePreview?.liveLabel ? <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-zinc-200">{venuePreview.liveLabel}</span> : null}
                  {venuePreview?.isOpenNow ? (
                    <span className="rounded-full border border-rose-300/40 bg-rose-500/20 px-2.5 py-1 text-rose-100">LIVE</span>
                  ) : null}
                </div>
                {venuePreview ? (
                  <Link href={`/venues/${venuePreview.slug ?? venuePreview.id}`} className="nightly-btn-secondary inline-flex min-h-9 items-center rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-xs font-medium text-violet-100">
                    View Venue
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-7 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4">
            <EventSectionHeading title="Friends" />
            <div className="grid gap-2 sm:grid-cols-2">
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Interested</p>
                <p className="mt-1 text-sm text-zinc-200">{friendPulse.interested.length > 0 ? friendPulse.interested.join(" • ") : "No friend activity yet"}</p>
              </article>
              <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Attending</p>
                <p className="mt-1 text-sm text-zinc-200">{friendPulse.attending.length > 0 ? friendPulse.attending.join(" • ") : "No friend activity yet"}</p>
              </article>
            </div>
            <button type="button" className="nightly-btn-secondary mt-3 min-h-10 rounded-full border border-violet-300/35 bg-violet-500/15 px-4 text-sm font-medium text-violet-100">
              Invite Friends
            </button>
          </section>

          <section className="mt-7">
            <EventSectionHeading title="Event Gallery" />
            <EventGallery images={galleryImages} />
          </section>

          <section className="mt-7">
            <EventSectionHeading title="Related Events" href="/events" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {relatedEvents.map((item) => (
                <RelatedEventCard
                  key={item.id}
                  href={item.href}
                  imageUrl={item.imageUrl}
                  title={item.name}
                  venue={item.venueName}
                  dateLabel={item.dateLabel}
                  genre={item.genres[0] ?? "Open Format"}
                />
              ))}
            </div>
          </section>

          <div className="mt-7 flex justify-center">
            <Link href="/events" className="nightly-btn-secondary rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200">
              Back to Events
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
