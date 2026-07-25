import { redirect } from "next/navigation";
import Link from "next/link";

import {
  computeDjCompletion,
  formatCentsAsUsd,
  getDjMixSummaryForProfile,
  getDjProfileForUser,
  requireDjForDashboard,
} from "../lib/data";

const quickActions = [
  {
    title: "Edit Profile",
    description: "Update your public DJ details and booking settings.",
    href: "/dj/onboarding",
  },
  {
    title: "Upload Sample Mix",
    description: "Add a featured public sample for your profile.",
    href: "/dj/mixes/new",
  },
  {
    title: "Manage Bookings",
    description: "Coming Soon",
    href: "#",
  },
  {
    title: "Availability",
    description: "Coming Soon",
    href: "#",
  },
  {
    title: "Analytics",
    description: "Coming Soon",
    href: "#",
  },
];

export default async function DjDashboardPage() {
  const user = await requireDjForDashboard();
  const profile = await getDjProfileForUser(user.id);

  if (!profile) {
    redirect("/dj/onboarding");
  }

  const [completion, rateLabel, mixSummary] = await Promise.all([
    Promise.resolve(computeDjCompletion(profile)),
    Promise.resolve(formatCentsAsUsd(profile.rateCents)),
    getDjMixSummaryForProfile(profile.id),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8 lg:p-10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">DJ Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Welcome back, {profile.stageName}.</h1>
        <p className="mt-3 text-base text-zinc-300">Your Phase 1 Nightly DJ workspace is live.</p>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Profile Completion</p>
            <p className="mt-2 text-2xl font-semibold text-white">{completion.percentage}%</p>
            <p className="mt-1 text-sm text-zinc-400">{completion.completed} of {completion.total} key fields complete</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Booking Availability</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {profile.isAvailableForBooking ? "Accepting Bookings" : "Not Available"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">Toggle this in Edit Profile.</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Starting Rate</p>
            <p className="mt-2 text-2xl font-semibold text-white">{rateLabel ?? "Not set"}</p>
            <p className="mt-1 text-sm text-zinc-400">Displayed on your public profile.</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Sample Mixes</p>
                <p className="mt-2 text-2xl font-semibold text-white">{mixSummary.totalMixes}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Featured: {mixSummary.featuredMix?.title ?? "No featured mix"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dj/mixes"
                  className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/50"
                >
                  Manage Mixes
                </Link>
                <Link
                  href="/dj/mixes/new"
                  className="rounded-full border border-violet-300/35 bg-violet-500/10 px-4 py-2 text-sm text-violet-100 transition hover:border-violet-300/50"
                >
                  Upload Mix
                </Link>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300/80">Featured Profile</p>
            <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-zinc-400">Stage Name</p>
                <p className="mt-1 font-medium text-white">{profile.stageName}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-zinc-400">City</p>
                <p className="mt-1 font-medium text-white">{profile.city ?? "Not set"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                <p className="text-zinc-400">Genres</p>
                <p className="mt-1 font-medium text-white">
                  {profile.genres.length > 0 ? profile.genres.join(", ") : "No genres selected"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                <p className="text-zinc-400">Public URL</p>
                <p className="mt-1 font-medium text-cyan-200">/dj/profile/{profile.username}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300/80">Quick Actions</p>
            <div className="mt-4 grid gap-3">
              {quickActions.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
                >
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                </a>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
