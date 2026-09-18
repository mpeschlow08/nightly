import Link from "next/link";
import VenueImage from "@/components/media/VenueImage";
import NightlyButton from "@/components/nightly/NightlyButton";
import NightlyLiveBadge from "@/components/nightly/NightlyLiveBadge";
import NightlySpecialGuestBadge from "@/components/nightly/NightlySpecialGuestBadge";

type HeroProps = {
  greeting: string;
  title: string;
  subtitle: string;
  featuredVenue: {
    name: string;
    href: string;
    imageUrl: string;
    neighborhood: string;
    isLive: boolean;
    specialGuestTitle?: string;
    specialGuestBadge?: string;
  } | null;
};

export default function Hero({ greeting, title, subtitle, featuredVenue }: HeroProps) {
  return (
    <section id="discover" className="mx-auto max-w-6xl px-4 pb-5 pt-3 sm:px-5 lg:px-8">
      <div className="nightly-card-hero nightly-fade-in overflow-hidden rounded-[1.35rem] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-medium tracking-[0.04em] text-[color:var(--text-secondary)]">{greeting}</p>
            <h1 className="nightly-display mt-2">
              {title}
            </h1>
            <p className="mt-3 max-w-[46ch] text-sm leading-6 text-[color:var(--text-secondary)]">
              {subtitle}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <NightlyButton href="/discover" variant="primary">
                Explore Tonight
              </NightlyButton>
              <NightlyButton href="/live" variant="secondary">
                Watch Live Floors
              </NightlyButton>
              <NightlyButton href="/concierge" variant="ghost">
                Ask Concierge
              </NightlyButton>
            </div>
          </div>

          {featuredVenue ? (
            <Link
              href={featuredVenue.href}
              className="group relative block overflow-hidden rounded-[1.15rem] border border-[color:var(--border)]"
              aria-label={`Open ${featuredVenue.name} details`}
            >
              <VenueImage
                src={featuredVenue.imageUrl}
                alt={`${featuredVenue.name} tonight`}
                orientation="horizontal"
                className="rounded-none"
                priority
              />
              <div className="nightly-image-overlay-hero absolute inset-0" />

              <div className="absolute left-3 top-3">
                {featuredVenue.isLive ? <NightlyLiveBadge label="Live Now" /> : null}
              </div>

              {featuredVenue.specialGuestTitle && featuredVenue.specialGuestBadge ? (
                <div className="absolute left-3 right-3 top-14">
                  <NightlySpecialGuestBadge
                    badge={featuredVenue.specialGuestBadge}
                    title={featuredVenue.specialGuestTitle}
                  />
                </div>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="text-[0.66rem] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">Tonight Pick</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{featuredVenue.name}</h2>
                <p className="mt-0.5 text-sm text-[color:var(--text-secondary)]">{featuredVenue.neighborhood}</p>
              </div>
            </Link>
          ) : (
            <div className="nightly-surface rounded-[1.1rem] p-4">
              <p className="text-sm text-[color:var(--text-secondary)]">No featured venue yet. Explore live venues and events to set your night.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
