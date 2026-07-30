import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import {
  formatCentsAsUsd,
  getDjFeaturedPublicMixForProfile,
  getDjPublicProfileByUsername,
} from "../../lib/data";
import { db } from "@/db";
import { users } from "@/db/schema";

type DjPublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

function socialLinks(profile: Awaited<ReturnType<typeof getDjPublicProfileByUsername>>) {
  if (!profile) {
    return [];
  }

  return [
    { label: "Instagram", url: profile.instagramUrl },
    { label: "TikTok", url: profile.tiktokUrl },
    { label: "SoundCloud", url: profile.soundcloudUrl },
    { label: "Website", url: profile.websiteUrl },
  ].filter((item) => Boolean(item.url));
}

export default async function DjPublicProfilePage({ params }: DjPublicProfilePageProps) {
  const { username } = await params;
  const profile = await getDjPublicProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const links = socialLinks(profile);
  const rateLabel = formatCentsAsUsd(profile.rateCents);
  const featuredMix = await getDjFeaturedPublicMixForProfile(profile.id);
  const { userId: clerkUserId } = await auth();

  let isDjOwnerViewingProfile = false;

  if (clerkUserId) {
    const viewer = await db.query.users.findFirst({
      where: eq(users.clerkUserId, clerkUserId),
      columns: { id: true, role: true },
    });

    isDjOwnerViewingProfile = viewer?.role === "dj" && viewer.id === profile.userId;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_35%),radial-gradient(circle_at_85%_15%,_rgba(167,139,250,0.12),_transparent_28%),linear-gradient(140deg,_#04070b_0%,_#090d18_50%,_#101428_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-cyan-400/30 bg-black/30 text-sm text-zinc-300">
              Profile Image
            </div>
            <p className="mt-4 text-center text-xs uppercase tracking-[0.28em] text-cyan-300/80">Nightly DJ</p>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-5">
            {isDjOwnerViewingProfile ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <Link
                  href="/dj/dashboard"
                  className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/60"
                >
                  Back to DJ Dashboard
                </Link>
                <Link
                  href="/dj/onboarding?edit=1"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/dj/mixes"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                >
                  Manage Mixes
                </Link>
              </div>
            ) : null}

            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{profile.stageName}</h1>
            <p className="mt-2 text-zinc-300">{profile.city ?? "City coming soon"}</p>
            <p className="mt-4 text-sm leading-7 text-zinc-300">{profile.bio ?? "Bio coming soon."}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Genres</p>
                <p className="mt-2 text-sm text-white">
                  {profile.genres.length > 0 ? profile.genres.join(", ") : "No genres listed"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Years Performing</p>
                <p className="mt-2 text-sm text-white">{profile.yearsPerforming ?? "Not listed"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Resident Venue</p>
                <p className="mt-2 text-sm text-white">
                  {profile.isResidentDj ? profile.residentVenueName ?? "Resident DJ" : "Independent"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Booking</p>
                <p className="mt-2 text-sm text-white">
                  {profile.isAvailableForBooking ? "Available" : "Currently unavailable"}
                  {rateLabel ? ` • from ${rateLabel}` : ""}
                </p>
              </div>
            </div>

            {links.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}

            {featuredMix ? (
              <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Featured Sample Mix</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{featuredMix.title}</h2>
                {featuredMix.genre ? <p className="mt-1 text-sm text-cyan-100">{featuredMix.genre}</p> : null}
                {featuredMix.description ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{featuredMix.description}</p>
                ) : null}
                {featuredMix.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featuredMix.coverImageUrl}
                    alt={`${featuredMix.title} cover art`}
                    className="mt-4 h-48 w-full rounded-xl object-cover"
                  />
                ) : null}
                <audio controls preload="none" className="mt-4 w-full">
                  <source src={featuredMix.audioUrl} />
                  Your browser does not support the audio player.
                </audio>
              </section>
            ) : null}

            <button
              type="button"
              className="mt-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              Book This DJ (Coming Soon)
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
