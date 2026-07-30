"use client";

import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";

export default function ProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-[#04070b] text-zinc-200">Loading profile…</div>;
  }

  if (!isSignedIn || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#04070b] px-4 py-10 text-zinc-100">
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(135deg,_#04070b_0%,_#080b14_60%,_#0b1020_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
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
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Tonight’s picks</p>
            <div className="mt-5 space-y-3">
              {[
                { name: "District Atlanta", reason: "Your EDM lane is lit tonight." },
                { name: "Rose Bar", reason: "A warm late-night match for your taste." },
                { name: "Tongue & Groove", reason: "Perfect for your current crew plan." },
              ].map((item) => (
                <div key={item.name} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="mt-1 text-zinc-400">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
