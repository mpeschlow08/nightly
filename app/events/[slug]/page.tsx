import Link from "next/link";
import { notFound } from "next/navigation";

import EventGallery from "@/components/event/detail/EventGallery";
import EventLineupCard from "@/components/event/detail/EventLineupCard";
import EventSectionHeading from "@/components/event/detail/EventSectionHeading";
import RelatedEventCard from "@/components/event/detail/RelatedEventCard";
import HeroImage from "@/components/media/HeroImage";
import NightlyBadge from "@/components/nightly/NightlyBadge";
import NightlyButton from "@/components/nightly/NightlyButton";
import NightlyCard from "@/components/nightly/NightlyCard";
import NightlyChip from "@/components/nightly/NightlyChip";
import NightlyLiveBadge from "@/components/nightly/NightlyLiveBadge";
import VenueImage from "@/components/media/VenueImage";
import {
  getEventBySlug,
  getExploreData,
  getUpcomingEvents,
  getVenueBySlug,
} from "@/lib/consumer/data";

type EventDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function profilePathFromName(name: string) {
  return `/dj/profile/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const [venuePreview, upcomingEvents, explore] = await Promise.all([
    getVenueBySlug(event.venueSlug),
    getUpcomingEvents(60),
    getExploreData(),
  ]);

  const relatedEvents = upcomingEvents
    .filter((item) => item.id !== event.id)
    .filter((item) => item.venueId === event.venueId || item.neighborhood === event.neighborhood)
    .slice(0, 8);

  const lineup = event.specialGuests.length > 0
    ? event.specialGuests.slice(0, 6).map((guest) => ({
        name: guest.stageName ?? guest.displayName,
        genre: guest.typeLabel,
        time: formatTime(guest.appearanceStartAtIso) ?? "Set time soon",
      }))
    : [
        { name: `${event.title} Resident`, genre: event.genres[0] ?? "Open Format", time: "11:00 PM" },
        { name: "Guest Set", genre: event.genres[0] ?? "Open Format", time: "12:30 AM" },
        { name: "Late Night Closer", genre: event.genres[0] ?? "Open Format", time: "2:00 AM" },
      ];

  const heroImage = event.artworkImageUrl;
  const galleryImages = [event.artworkImageUrl, venuePreview?.heroImageUrl, venuePreview?.thumbnailImageUrl]
    .filter((item): item is string => Boolean(item));

  const guestListStatus = event.guestListUrl ? "Guest list available" : "Guest list not available";
  const ticketingStatus = event.requiresTickets
    ? event.ticketStatus
    : event.supportsFreeRsvp
      ? "Free RSVP available"
      : "No ticketing required";
  const salesWindowLabel = event.salesStartAtIso
    ? `${formatDateTime(event.salesStartAtIso)}${event.salesEndAtIso ? ` - ${formatDateTime(event.salesEndAtIso)}` : ""}`
    : "Sales window not set";
  const specialGuests = event.specialGuests;
  const friendAwareNearby = explore.friendsInterestedEvents.filter((item) => item.id !== event.id && item.neighborhood === event.neighborhood).length;
  const friendAwareVenue = explore.friendsInterestedEvents.filter((item) => item.venueId === event.venueId).length;
  const neighborhoodMomentum = upcomingEvents.filter((item) => item.neighborhood === event.neighborhood).length;
  const liveNearby = upcomingEvents.filter((item) => item.neighborhood === event.neighborhood && item.isLive).length;
  const hasPrimaryTicketAction = event.requiresTickets || event.supportsFreeRsvp || event.waitlistEnabled;

  return (
    <main className="nightly-page min-h-screen overflow-x-hidden antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(24,136,201,0.2),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(255,120,90,0.18),_transparent_26%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
          <section className="nightly-surface-elevated overflow-hidden">
            <div className="relative">
              <HeroImage src={heroImage} alt={`${event.title} hero`} className="rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/40 to-black/10" />

              <div className="absolute right-3 top-3 flex items-center gap-2">
                {liveNearby > 0 ? <NightlyLiveBadge label="Live Nearby" countLabel={`${liveNearby}`} /> : null}
              </div>

              <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <NightlyBadge>{event.dateLabel}</NightlyBadge>
                  {event.specialGuestHighlight ? <NightlyBadge tone="special">{event.specialGuestHighlight.badge}</NightlyBadge> : null}
                  {event.ageRequirementLabel ? <NightlyBadge>{event.ageRequirementLabel}</NightlyBadge> : null}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">{event.title}</h1>
                <p className="text-sm text-zinc-200 sm:text-base">{event.venueName} • {event.startLabel}{event.endLabel ? ` - ${event.endLabel}` : ""} • {event.neighborhood}</p>
                <div className="flex flex-wrap gap-2 text-[0.72rem]">
                  {event.genres.slice(0, 4).map((genre) => (
                    <NightlyChip key={genre} label={genre} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="nightly-surface-elevated p-4 sm:p-5">
                <EventSectionHeading title="Event Summary" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <NightlyCard className="rounded-2xl p-4 sm:col-span-2">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Description</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{event.description ?? "Details will be shared by the venue soon."}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Genres</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{event.genres.join(" • ")}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Dress Code</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{event.dressCode ?? "Smart casual"}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Cover</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{event.coverLabel}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl border-violet-300/25 bg-violet-500/12 p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-violet-200">Guest List</p>
                    <p className="mt-1 text-sm text-violet-100">{guestListStatus}</p>
                  </NightlyCard>
                </div>
              </section>

              {specialGuests.length > 0 ? (
                <section className="nightly-surface-elevated border-amber-300/25 bg-amber-500/10 p-4 sm:p-5">
                  <EventSectionHeading title="Special Guests" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {specialGuests.map((guest) => (
                      <article key={guest.id} className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
                        <p className="text-[0.66rem] uppercase tracking-[0.14em] text-amber-100">
                          {guest.typeLabel}
                          {guest.verificationStatus === "verified" ? " • VERIFIED" : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">{guest.stageName ?? guest.displayName}</p>
                        <p className="mt-1 text-xs text-zinc-300">
                          {formatDateTime(guest.appearanceStartAtIso)} - {formatDateTime(guest.appearanceEndAtIso)}
                        </p>
                        {guest.shortDescription ? <p className="mt-2 text-xs text-zinc-400">{guest.shortDescription}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <EventSectionHeading title="Lineup" />
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {lineup.map((act) => (
                    <EventLineupCard
                      key={`${act.name}-${act.time}`}
                      imageUrl={heroImage}
                      name={act.name}
                      genre={act.genre}
                      time={act.time}
                      profileHref={profilePathFromName(act.name)}
                    />
                  ))}
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <EventSectionHeading title="Event Gallery" />
                <EventGallery images={galleryImages} />
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
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
            </div>

            <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              <section className="nightly-surface-elevated p-4 sm:p-5">
                <EventSectionHeading title="Tickets & Entry" />
                <div className="grid gap-2 text-sm">
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Ticketing</p>
                    <p className="mt-1 text-[color:var(--text-secondary)]">{ticketingStatus}</p>
                    <p className="mt-1 text-xs text-zinc-500">Sales window: {salesWindowLabel}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Price</p>
                    <p className="mt-1 text-[color:var(--text-secondary)]">{event.startingPriceCents != null ? `$${Math.round(event.startingPriceCents / 100)}` : "No cover"}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Capacity</p>
                    <p className="mt-1 text-[color:var(--text-secondary)]">{event.capacity != null ? `${event.capacity} total` : "Capacity not set"}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Policies</p>
                    <p className="mt-1 text-[color:var(--text-secondary)]">{event.transferPolicy} • {event.refundPolicy}</p>
                  </NightlyCard>
                </div>

                <div className="mt-3 grid gap-2">
                  {event.requiresTickets ? (
                    <NightlyButton href={`/tickets?event=${event.slug}`} variant="primary" className="w-full">
                      Buy Tickets
                    </NightlyButton>
                  ) : null}
                  {!event.requiresTickets && event.supportsFreeRsvp ? (
                    <NightlyButton href={`/tickets?event=${event.slug}`} variant="primary" className="w-full">
                      RSVP Free
                    </NightlyButton>
                  ) : null}
                  {!hasPrimaryTicketAction ? (
                    <NightlyButton href={`/tickets?event=${event.slug}`} variant="secondary" className="w-full">
                      View Ticket Options
                    </NightlyButton>
                  ) : null}
                  {event.waitlistEnabled ? (
                    <NightlyButton href={`/tickets?event=${event.slug}`} variant="secondary" className="w-full">
                      Join Waitlist
                    </NightlyButton>
                  ) : null}
                  {event.guestListUrl || event.supportsFreeRsvp ? (
                    <NightlyButton href={`/tickets?event=${event.slug}`} variant="secondary" className="w-full">
                      Join Guest List
                    </NightlyButton>
                  ) : null}
                  <NightlyButton
                    href={venuePreview?.googleMapsUrl ?? `https://maps.google.com/?q=${encodeURIComponent(`${event.venueName} ${event.neighborhood}`)}`}
                    variant="ghost"
                    className="w-full"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get Directions
                  </NightlyButton>
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <EventSectionHeading title="Social Momentum" />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Friend-aware picks nearby</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{friendAwareNearby}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Friend-aware picks at this venue</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{friendAwareVenue}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Neighborhood event momentum</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{neighborhoodMomentum}</p>
                  </NightlyCard>
                </div>
                <p className="mt-3 text-xs text-[color:var(--text-muted)]">
                  Social signals are aggregate and privacy-safe. Individual friend identities are not shown.
                </p>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <EventSectionHeading title="Venue Preview" />
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <div className="relative">
                    <VenueImage src={venuePreview?.heroImageUrl ?? heroImage} alt={`${event.venueName} preview`} orientation="horizontal" className="rounded-none" />
                    <div className="nightly-image-overlay absolute inset-0" />
                  </div>
                  <div className="space-y-2.5 p-3.5">
                    <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{event.venueName}</h3>
                    <p className="text-xs text-[color:var(--text-secondary)]">{event.neighborhood}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {venuePreview?.liveLabel ? <NightlyBadge tone="live">{venuePreview.liveLabel}</NightlyBadge> : null}
                      {venuePreview?.specialGuestHighlight ? <NightlyBadge tone="special">{venuePreview.specialGuestHighlight.badge}</NightlyBadge> : null}
                    </div>
                    {venuePreview ? (
                      <NightlyButton href={`/venues/${venuePreview.slug ?? venuePreview.id}`} variant="secondary" className="min-h-9 px-3 py-2 text-xs">
                        View Venue
                      </NightlyButton>
                    ) : null}
                  </div>
                </div>
              </section>
            </aside>
          </div>

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
