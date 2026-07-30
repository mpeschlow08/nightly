import Link from "next/link";
import { notFound } from "next/navigation";

import HeroImage from "@/components/media/HeroImage";
import SimilarVenueCard from "@/components/venue/detail/SimilarVenueCard";
import VenueDjCard from "@/components/venue/detail/VenueDjCard";
import VenueEventCard from "@/components/venue/detail/VenueEventCard";
import VenueInfoItem from "@/components/venue/detail/VenueInfoItem";
import VenueSectionHeading from "@/components/venue/detail/VenueSectionHeading";
import VenueImageGallery from "@/components/venue/VenueImageGallery";
import {
  getEventsForVenue,
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

async function VenueContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await getVenueBySlug(id);

  if (!venue) {
    notFound();
  }

  const [venueEvents, featuredDjs, similarVenues] = await Promise.all([
    getEventsForVenue(venue.id),
    getFeaturedDJsForVenue(venue.name),
    getSimilarVenues(venue.id),
  ]);

  const todayIndex = new Date().getDay();
  const hoursStatus = {
    isOpenNow: venue.isOpenNow,
    statusLabel: venue.isOpenNow ? "Open now" : "Closed right now",
    todayHoursLabel: "Hours unavailable",
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

  const reviews = {
    rating: venue.averageRating ?? 4.4,
    totalReviews: venue.reviewCount ?? 0,
    recent: [
      { id: 1, author: "Nightly Guest", rating: 4.7, when: "Recent", text: "Great atmosphere and consistent sound all night." },
      { id: 2, author: "City Explorer", rating: 4.4, when: "This week", text: "Friendly staff and a fun crowd." },
    ],
  };

  const crowdLevel = venue.liveLabel ? "Buzzing" : "Steady";
  const isLive = Boolean(venue.liveLabel);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(26,52,123,0.22),_transparent_35%),radial-gradient(circle_at_88%_7%,_rgba(147,51,234,0.22),_transparent_22%)]" />

        <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-3 sm:px-5 lg:px-6">
          <section className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#060a14] shadow-[0_26px_64px_rgba(0,0,0,0.46)]">
            <div className="relative">
              <HeroImage src={heroImage} alt={`${venue.name} hero`} className="rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/46 to-black/18" />

              <div className="absolute right-3 top-3 flex items-center gap-2">
                <button type="button" className="nightly-btn-secondary min-h-9 rounded-full border border-white/20 bg-black/35 px-3 text-xs text-zinc-100">
                  Favorite
                </button>
                <button type="button" className="nightly-btn-secondary min-h-9 rounded-full border border-white/20 bg-black/35 px-3 text-xs text-zinc-100">
                  Share
                </button>
              </div>

              <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {isLive ? (
                    <span className="rounded-full border border-rose-300/40 bg-rose-500/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-rose-100">
                      LIVE
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] text-zinc-100">
                    Crowd: {crowdLevel}
                  </span>
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.9rem]">{venue.name}</h1>
                  <p className="mt-1 text-sm text-zinc-200">{venue.neighborhood ?? "Atlanta"}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {venue.genres.slice(0, 4).map((genre) => (
                    <span key={genre} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-zinc-100">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <a
              href={venue.googleMapsUrl ?? `https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
              className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-center text-sm text-zinc-100"
            >
              Directions
            </a>
            {phoneDial ? (
              <a href={`tel:${phoneDial}`} className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-center text-sm text-zinc-100">
                Call Venue
              </a>
            ) : (
              <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-zinc-400" disabled>
                Call Venue
              </button>
            )}
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-3 text-center text-sm text-zinc-100"
            >
              Website
            </a>
            <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-sm font-medium text-violet-100">
              Reserve Table
            </button>
            <button type="button" className="nightly-btn-secondary col-span-2 min-h-11 rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-sm font-medium text-violet-100 sm:col-span-1">
              Join Guest List
            </button>
          </section>

          <section className="mt-5 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
            <VenueSectionHeading title="Tonight" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <article className="rounded-[0.9rem] border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Status</p>
                <p className={`mt-1 text-sm font-medium ${hoursStatus.isOpenNow ? "text-emerald-300" : "text-zinc-200"}`}>{hoursStatus.statusLabel}</p>
              </article>
              <article className="rounded-[0.9rem] border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Crowd</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{crowdLevel}</p>
              </article>
              <article className="rounded-[0.9rem] border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Wait</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{waitEstimate}</p>
              </article>
              <article className="rounded-[0.9rem] border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Cover</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{coverLabel}</p>
              </article>
              <article className="rounded-[0.9rem] border border-white/10 bg-white/5 p-3 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Now Playing</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{nowPlaying}</p>
              </article>
              <article className="rounded-[0.9rem] border border-violet-300/30 bg-violet-500/12 p-3 sm:col-span-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200">Peak Hours</p>
                <p className="mt-1 text-sm font-medium text-violet-100">{peakHours}</p>
              </article>
            </div>
          </section>

          <VenueImageGallery
            imageClass={null}
            images={venueGalleryCandidates}
          />

          <section className="mt-7">
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

          <section className="mt-7">
            <VenueSectionHeading title="Featured DJs" href="/events" />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {featuredDjs.map((dj) => (
                <VenueDjCard key={dj.id} name={dj.name} genres={dj.genres} imageUrl={dj.imageUrl ?? heroImage} profileHref={dj.profileHref} />
              ))}
            </div>
          </section>

          <section className="mt-7 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4">
            <VenueSectionHeading title="Venue Information" />
            <div className="grid gap-2 sm:grid-cols-2">
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

          <section className="mt-7 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4">
            <VenueSectionHeading title="Amenities" />
            <div className="flex flex-wrap gap-2">
              {amenities.map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-7 rounded-[1.2rem] border border-white/10 bg-[#070c17] p-4">
            <VenueSectionHeading title="Reviews" href="/discover" actionLabel="View All Reviews" />
            <div className="flex items-end justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Overall Rating</p>
                <p className="mt-1 text-xl font-semibold text-white">{reviews.rating.toFixed(1)} / 5</p>
              </div>
              <p className="text-xs text-zinc-400">{reviews.totalReviews} reviews</p>
            </div>

            <div className="mt-3 space-y-2">
              {reviews.recent.map((review) => (
                <article key={review.id} className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">{review.author}</p>
                    <p className="text-xs text-zinc-400">{review.rating.toFixed(1)} • {review.when}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-300">{review.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7">
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
