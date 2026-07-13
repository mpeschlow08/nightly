"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const genreOptions = ["House", "EDM", "Hip-Hop", "R&B", "Latin", "Afrobeats", "Tech House"];
const venueOptions = ["District Atlanta", "Tongue & Groove", "Rose Bar", "Future Atlanta", "Havana Club"];

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("Atlanta");
  const [genres, setGenres] = useState<string[]>(["House", "EDM"]);
  const [venues, setVenues] = useState<string[]>(["District Atlanta"]);
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const toggleChip = (value: string, selected: string[], setter: (next: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    await user.update({
      username,
      unsafeMetadata: {
        city,
        favoriteGenres: genres,
        favoriteVenues: venues,
        profilePhoto: photo || user.imageUrl,
      },
    });

    router.push("/profile");
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(135deg,_#04070b_0%,_#080b14_60%,_#0b1020_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.12)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Welcome to Nightly</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Build your nightlife profile.</h1>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            Personalize your Nightly experience with your vibe, your favorite rooms, and the crews you want to meet.
          </p>
        </div>

        <form className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]" onSubmit={handleSubmit}>
          <div className="space-y-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Username</label>
              <input value={username} onChange={(event) => setUsername(event.target.value)} required className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" placeholder="nightowl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Home city</label>
              <input value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Profile photo URL</label>
              <input value={photo} onChange={(event) => setPhoto(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-6 rounded-[1.5rem] border border-white/10 bg-zinc-950/80 p-5">
            <div>
              <p className="text-sm font-semibold text-white">Favorite genres</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {genreOptions.map((genre) => (
                  <button key={genre} type="button" onClick={() => toggleChip(genre, genres, setGenres)} className={`rounded-full px-3 py-2 text-sm transition ${genres.includes(genre) ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "border border-white/10 bg-white/5 text-zinc-300"}`}>
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Favorite venues</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {venueOptions.map((venue) => (
                  <button key={venue} type="button" onClick={() => toggleChip(venue, venues, setVenues)} className={`rounded-full px-3 py-2 text-sm transition ${venues.includes(venue) ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "border border-white/10 bg-white/5 text-zinc-300"}`}>
                    {venue}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90">
              Finish onboarding
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
