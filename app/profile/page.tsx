"use client";

import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";

export default function ProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div className="nightly-page flex min-h-screen items-center justify-center text-zinc-200">Loading profile…</div>;
  }

  if (!isSignedIn || !user) {
    return (
      <main className="nightly-page flex min-h-screen items-center justify-center px-4 py-10 text-zinc-100">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 text-center shadow-[0_0_90px_rgba(34,211,238,0.12)]">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Nightly</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Sign in to access your profile</h1>
          <p className="mt-3 text-sm text-zinc-400">Your saved venues, crews, and recommendation feed live here.</p>
          <Link href="/sign-in" className="mt-6 inline-flex rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white">
            Continue to sign in
          </Link>
        </div>
      </main>
    );
  }

  const metadata = user.unsafeMetadata as Record<string, unknown>;
  const favoriteGenres = Array.isArray(metadata.favoriteGenres) ? metadata.favoriteGenres : [];
  const favoriteVenues = Array.isArray(metadata.favoriteVenues) ? metadata.favoriteVenues : [];
  const city = typeof metadata.city === "string" ? metadata.city : "Atlanta";

  return (
    <main className="nightly-page px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.12)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Profile</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{user.username ?? user.firstName ?? "Your Nightly profile"}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
              Save venues, follow DJs and crews, RSVP to plans, and keep your nightlife recommendations tuned to your vibe.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/discover" className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
              Discover venues
            </Link>
            <Link href="/profile/settings" className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-violet-300/40 hover:text-white">
              Settings
            </Link>
            <SignOutButton>
              <button className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.imageUrl} alt={user.username ?? "User"} className="h-16 w-16 rounded-full border border-cyan-400/30 object-cover" />
              <div>
                <p className="text-lg font-semibold text-white">{user.username ?? user.firstName ?? "Night Owl"}</p>
                <p className="text-sm text-zinc-400">{city}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm text-zinc-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-zinc-400">Saved venues</p>
                <p className="mt-1 font-medium text-white">{favoriteVenues.length > 0 ? favoriteVenues.join(", ") : "No venues saved yet"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-zinc-400">Favorite genres</p>
                <p className="mt-1 font-medium text-white">{favoriteGenres.length > 0 ? favoriteGenres.join(", ") : "Set your initial vibe"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-zinc-950/80 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Your Nightly tools</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Reservations", "/bookings", "View upcoming and past requests."],
                ["Link Up", "/crews", "See friends, plans, and your Friend Code."],
                ["Premium", "/profile/premium", "Review your current access."],
                ["Privacy", "/profile/privacy", "Tune social and location sharing."],
              ].map(([label, href, description]) => (
                <Link key={href} href={href} className="nightly-card nightly-card-interactive rounded-[1.2rem] p-4 text-sm">
                  <p className="font-medium text-white">{label}</p>
                  <p className="mt-1 text-zinc-400">{description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
