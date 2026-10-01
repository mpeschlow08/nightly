import Link from "next/link";
import VenueImage from "@/components/media/VenueImage";
import NightlyLiveBadge from "@/components/nightly/NightlyLiveBadge";

type HeroProps = {
  displayName: string | null;
  featuredVenue: {
    name: string;
    href: string;
    imageUrl: string;
    neighborhood: string;
    genre: string;
    crowdLevel: string | null;
    liveLabel: "OPEN NOW" | "EVENT LIVE" | "CAMERA LIVE" | "TRENDING" | null;
    specialGuestTitle?: string;
  } | null;
};

export default function Hero({ displayName, featuredVenue }: HeroProps) {
  const isTrulyLive = featuredVenue?.liveLabel === "EVENT LIVE" || featuredVenue?.liveLabel === "CAMERA LIVE";
  const activityLabel = featuredVenue?.liveLabel === "OPEN NOW"
    ? "Open now"
    : featuredVenue?.liveLabel === "TRENDING"
      ? "Trending"
      : "Tonight";

  return (
    <section className="mx-auto max-w-[760px] pt-4 sm:pt-6" aria-labelledby="tonight-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            Good evening{displayName ? `, ${displayName}` : ""} <span aria-hidden="true">👋</span>
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Atlanta · Tonight</p>
        </div>
        <Link href="/map" aria-label="Open nightlife map" title="Open map" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#100d18] text-lg text-violet-200 transition hover:border-violet-300/45 hover:bg-violet-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70">
          <span aria-hidden="true">⌖</span>
        </Link>
      </div>

      <div className="mb-3 mt-5 flex items-center justify-between gap-3">
        <h1 id="tonight-heading" className="text-[1.4rem] font-semibold leading-tight text-white sm:text-2xl">Tonight in Atlanta</h1>
        <Link href="/discover" className="shrink-0 text-xs font-medium text-violet-200 hover:text-white">Explore</Link>
      </div>

      {featuredVenue ? (
        <Link href={featuredVenue.href} className="group relative block aspect-[1.16] max-h-[440px] overflow-hidden rounded-[1.15rem] border border-white/10 bg-[#100d18] transition hover:border-violet-300/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 sm:aspect-[1.65]" aria-label={`Open ${featuredVenue.name} tonight`}>
          <VenueImage src={featuredVenue.imageUrl} alt={`${featuredVenue.name} nightlife tonight`} orientation="horizontal" className="!absolute !inset-0 !h-full !w-full !aspect-auto !rounded-none transition duration-500 group-hover:scale-[1.025]" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/5" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-4 sm:top-4">
            {isTrulyLive ? <NightlyLiveBadge label="Live" /> : <span className="rounded-full border border-violet-200/30 bg-[#100b1b]/80 px-2.5 py-1 text-[0.62rem] font-semibold uppercase text-violet-100">{activityLabel}</span>}
            {featuredVenue.specialGuestTitle ? <span className="max-w-[52vw] truncate rounded-full border border-amber-200/30 bg-black/55 px-2.5 py-1 text-[0.62rem] font-medium text-amber-100">Special Guest · {featuredVenue.specialGuestTitle}</span> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <h2 className="line-clamp-2 text-xl font-semibold leading-tight text-white sm:text-2xl">{featuredVenue.name}</h2>
            <p className="mt-1.5 text-sm text-white/80">{[featuredVenue.neighborhood, featuredVenue.genre].filter(Boolean).join(" · ")}</p>
            {featuredVenue.crowdLevel ? <p className="mt-2 text-xs font-medium text-white/90">{featuredVenue.crowdLevel} tonight</p> : null}
          </div>
          <span aria-hidden="true" className="absolute bottom-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-lg text-white backdrop-blur sm:bottom-5 sm:right-5">→</span>
        </Link>
      ) : (
        <div className="flex min-h-52 items-end justify-between gap-4 rounded-[1.15rem] border border-white/10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(168,117,255,0.16),transparent_55%),#100d18] p-4 sm:p-5">
          <p className="max-w-[32ch] text-sm text-[color:var(--text-secondary)]">Tonight is still taking shape. Browse what is open in Atlanta.</p>
          <Link href="/discover" className="shrink-0 rounded-full bg-violet-400 px-3.5 py-2 text-xs font-semibold text-black hover:bg-violet-300">Discover</Link>
        </div>
      )}
    </section>
  );
}
