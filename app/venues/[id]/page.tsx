import Link from "next/link";
import { notFound } from "next/navigation";

import HeroImage from "@/components/media/HeroImage";
import NightlyBadge from "@/components/nightly/NightlyBadge";
import NightlyButton from "@/components/nightly/NightlyButton";
import NightlyCard from "@/components/nightly/NightlyCard";
import NightlyChip from "@/components/nightly/NightlyChip";
import NightlyLiveBadge from "@/components/nightly/NightlyLiveBadge";
import SimilarVenueCard from "@/components/venue/detail/SimilarVenueCard";
import VenueDjCard from "@/components/venue/detail/VenueDjCard";
import VenueEventCard from "@/components/venue/detail/VenueEventCard";
import VenueInfoItem from "@/components/venue/detail/VenueInfoItem";
import VenueSectionHeading from "@/components/venue/detail/VenueSectionHeading";
import VenueImageGallery from "@/components/venue/VenueImageGallery";
import {
  getEventsForVenue,
  getExploreData,
  getFeaturedDJsForVenue,
  getSimilarVenues,
  getVenueBySlug,
} from "@/lib/consumer/data";

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  return <VenueContent params={params} />;
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function normalizePhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^\d+]/g, "");

  return digits.length > 0 ? digits : null;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet synchronized";
  }

  return new Date(value).toLocaleString();
}

async function VenueContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await getVenueBySlug(id);

  if (!venue) {
    notFound();
  }

  const [venueEvents, featuredDjs, similarVenues, explore] = await Promise.all([
    getEventsForVenue(venue.id),
    getFeaturedDJsForVenue(venue.name),
    getSimilarVenues(venue.id),
    getExploreData(),
  ]);

  const todayIndex = new Date().getDay();
  const hoursStatus = {
    isOpenNow: venue.isOpenNow,
    statusLabel: venue.isOpenNow ? "Open now" : "Closed right now",
    todayHoursLabel: venue.openingHoursJson ? "Imported schedule available" : "Hours unavailable",
  };

  const heroImage = venue.heroImageUrl;
  const venueGalleryCandidates =
    venue.galleryImageUrls.length > 0
      ? venue.galleryImageUrls.map((imageUrl, index) => ({ id: -1000 - index, imageUrl }))
      : [
          { id: -1, imageUrl: heroImage },
          { id: -2, imageUrl: venue.thumbnailImageUrl },
        ];

  const address =
    venue.address ??
    (venue.neighborhood && venue.city
      ? `${venue.neighborhood}, ${venue.city}`
      : venue.city ?? "Address coming soon");

  const websiteUrl = normalizeUrl(venue.websiteUrl) ?? "#";
  const phone = venue.phone ?? "Phone not available";
  const phoneDial = normalizePhone(venue.phone);
  const parkingInfo = venue.parkingInformation ?? "Street and garage parking nearby";

  const nowPlaying = venue.genres.join(" • ") || "Open format";
  const peakHours = "10:30 PM - 1:30 AM";
  const waitEstimate = venue.liveLabel ? "High demand" : "No wait";
  const coverLabel = venue.coverChargeInformation ?? "Varies";
  const amenities = venue.amenities.length > 0 ? venue.amenities : ["Dance Floor", "Bar", "Accessibility"];

  const ratingValue =
    typeof venue.googleRating === "number"
      ? venue.googleRating
      : typeof venue.averageRating === "number"
        ? venue.averageRating
        : null;

  const ratingCount =
    typeof venue.googleUserRatingCount === "number"
      ? venue.googleUserRatingCount
      : typeof venue.reviewCount === "number"
        ? venue.reviewCount
        : null;

  const freshnessLabel = formatDateTime(venue.googleDataLastFetchedAt);
  const crowdLevel = venue.liveLabel ? "Buzzing" : "Steady";
  const isLive = Boolean(venue.liveLabel);
  const specialGuests = venue.specialGuests;
  const friendAwareVenue = explore.friendsInterestedVenues.filter((item) => item.id === venue.id).length;
  const friendAwareNeighborhood = explore.friendsInterestedVenues.filter((item) => item.neighborhood === venue.neighborhood).length;
  const liveNeighborhoodCount = explore.venues.filter((item) => item.neighborhood === venue.neighborhood && item.isLive).length;

  return (
    <main className="nightly-page min-h-screen overflow-x-hidden antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(26,124,212,0.2),_transparent_35%),radial-gradient(circle_at_88%_7%,_rgba(255,126,92,0.16),_transparent_24%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
          <section className="nightly-surface-elevated overflow-hidden">
            <div className="relative">
              <HeroImage src={heroImage} alt={`${venue.name} hero`} className="rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/46 to-black/18" />

              <div className="absolute right-3 top-3 flex items-center gap-2">
                {isLive ? <NightlyLiveBadge label="Live" countLabel={liveNeighborhoodCount > 0 ? `${liveNeighborhoodCount} nearby` : null} /> : null}
              </div>

              <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {venue.liveLabel ? <NightlyBadge tone="live">{venue.liveLabel}</NightlyBadge> : null}
                  {venue.specialGuestHighlight ? <NightlyBadge tone="special">{venue.specialGuestHighlight.badge}</NightlyBadge> : null}
                  <NightlyBadge>Crowd: {crowdLevel}</NightlyBadge>
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">{venue.name}</h1>
                  <p className="mt-1 text-sm text-zinc-200 sm:text-base">{venue.neighborhood ?? "Atlanta"}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {venue.genres.slice(0, 4).map((genre) => (
                    <NightlyChip key={genre} label={genre} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Tonight" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Status</p>
                    <p className={`mt-1 text-sm font-medium ${hoursStatus.isOpenNow ? "text-emerald-300" : "text-[color:var(--text-secondary)]"}`}>{hoursStatus.statusLabel}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Crowd</p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">{crowdLevel}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Wait</p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">{waitEstimate}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Cover</p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">{coverLabel}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3 sm:col-span-2">
                    <p className="text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Now Playing</p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">{nowPlaying}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl border-violet-300/30 bg-violet-500/12 p-3 sm:col-span-3">
                    <p className="text-[0.64rem] uppercase tracking-[0.16em] text-violet-200">Peak Hours</p>
                    <p className="mt-1 text-sm font-medium text-violet-100">{peakHours}</p>
                  </NightlyCard>
                </div>
              </section>

              {specialGuests.length > 0 ? (
                <section className="nightly-surface-elevated border-amber-300/25 bg-amber-500/10 p-4 sm:p-5">
                  <VenueSectionHeading title="Special Guests" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {specialGuests.map((guest) => (
                      <article key={guest.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
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
                <VenueSectionHeading title="Gallery" />
                <VenueImageGallery imageClass={null} images={venueGalleryCandidates} />
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Tonight's Events" href="/events" />
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {venueEvents.slice(0, 8).map((event) => (
                    <VenueEventCard
                      key={event.id}
                      href={event.href}
                      imageUrl={event.imageUrl}
                      title={event.name}
                      startTime={event.startTimeLabel}
                      endTime={event.endTimeLabel ?? "Late"}
                      dj={event.genres[0] ?? "Guest DJ"}
                      ticketStatus={event.ticketStatus}
                    />
                  ))}
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Featured DJs" href="/events" />
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {featuredDjs.map((dj) => (
                    <VenueDjCard key={dj.id} name={dj.name} genres={dj.genres} imageUrl={dj.imageUrl ?? heroImage} profileHref={dj.profileHref} />
                  ))}
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Similar Venues" href="/discover" />
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {similarVenues.map((item) => (
                    <SimilarVenueCard
                      key={item.id}
                      href={item.href}
                      name={item.name}
                      genre={item.genres[0] ?? "Open Format"}
                      distance={item.distanceLabel ?? "--"}
                      imageUrl={item.heroImageUrl}
                    />
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Plan Your Night" />
                <div className="grid gap-2">
                  <NightlyButton href="/bookings" variant="primary" className="w-full">
                    Reserve Table
                  </NightlyButton>
                  <NightlyButton href="/events" variant="secondary" className="w-full">
                    Join Guest List
                  </NightlyButton>
                  <NightlyButton
                    href={venue.googleMapsUrl ?? `https://maps.google.com/?q=${encodeURIComponent(address)}`}
                    variant="ghost"
                    className="w-full"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get Directions
                  </NightlyButton>
                  {phoneDial ? (
                    <NightlyButton href={`tel:${phoneDial}`} variant="ghost" className="w-full">
                      Call Venue
                    </NightlyButton>
                  ) : null}
                  {websiteUrl !== "#" ? (
                    <NightlyButton href={websiteUrl} variant="ghost" className="w-full" target="_blank" rel="noreferrer">
                      Visit Website
                    </NightlyButton>
                  ) : null}
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Social Momentum" />
                <div className="grid gap-2">
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Friend-aware venue picks</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{friendAwareVenue}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Friend-aware picks in neighborhood</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{friendAwareNeighborhood}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Live venues nearby</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{liveNeighborhoodCount}</p>
                  </NightlyCard>
                </div>
                <p className="mt-3 text-xs text-[color:var(--text-muted)]">Signals are aggregated for privacy and are not person-level attendance claims.</p>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Venue Information" />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <VenueInfoItem icon="AD" label="Address" value={address} />
                  <VenueInfoItem icon="HR" label="Hours" value={`${dayLabels[todayIndex]}: ${hoursStatus.todayHoursLabel}`} />
                  <VenueInfoItem icon="PH" label="Phone" value={phone} />
                  <VenueInfoItem icon="WB" label="Website" value={websiteUrl === "#" ? "Website not available" : websiteUrl.replace(/^https?:\/\//, "")} />
                  <VenueInfoItem icon="DR" label="Dress Code" value={venue.dressCode ?? "Smart casual"} />
                  <VenueInfoItem icon="AG" label="Age Requirement" value={venue.ageRequirementLabel ?? "21+"} />
                  <VenueInfoItem icon="PK" label="Parking" value={parkingInfo} />
                  <VenueInfoItem icon="VT" label="Valet" value={venue.valetAvailable === null ? "Not listed" : venue.valetAvailable ? "Available" : "Not available"} />
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Data Source" />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Google sync status</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{venue.googleRefreshStatus}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Last checked</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{freshnessLabel}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Business status</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{venue.googleBusinessStatus ?? "Unknown"}</p>
                  </NightlyCard>
                  <NightlyCard className="rounded-2xl p-3">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Primary type</p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{venue.googlePrimaryType ?? "Not provided"}</p>
                  </NightlyCard>
                </div>
                <p className="mt-3 text-xs text-[color:var(--text-muted)]">
                  Nightly-specific live data such as crowd shifts, cover updates, lineups, and venue announcements comes from Nightly and venue systems.
                </p>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Amenities" />
                <div className="flex flex-wrap gap-2">
                  {amenities.map((item) => (
                    <NightlyChip key={item} label={item} />
                  ))}
                </div>
              </section>

              <section className="nightly-surface-elevated p-4 sm:p-5">
                <VenueSectionHeading title="Reviews" href="/discover" actionLabel="View All Reviews" />
                <div className="flex items-end justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Overall Rating</p>
                    <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{ratingValue != null ? `${ratingValue.toFixed(1)} / 5` : "Unavailable"}</p>
                  </div>
                  <p className="text-xs text-[color:var(--text-secondary)]">{ratingCount != null ? `${ratingCount} reviews` : "No review metadata"}</p>
                </div>
                {venue.googleAttributions.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Photo attribution</p>
                    <ul className="mt-2 space-y-1 text-xs text-[color:var(--text-secondary)]">
                      {venue.googleAttributions.slice(0, 6).map((item) => (
                        <li key={`${item.displayName ?? "unknown"}-${item.uri ?? "none"}`}>
                          {item.uri ? (
                            <a href={item.uri} target="_blank" rel="noreferrer" className="text-cyan-200 hover:text-cyan-100">
                              {item.displayName ?? "Google contributor"}
                            </a>
                          ) : (
                            item.displayName ?? "Google contributor"
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </aside>
          </div>

          <div className="mt-7 flex justify-center">
            <Link href="/discover" className="nightly-btn-secondary rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200">
              Back to Explore
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
