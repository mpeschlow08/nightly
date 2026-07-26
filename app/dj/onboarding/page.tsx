import { redirect } from "next/navigation";

import { saveDjOnboarding } from "@/app/dj/actions";

import {
  DJ_GENRE_OPTIONS,
  getDjProfileForUser,
  requireDjForOnboarding,
} from "../lib/data";

type DjOnboardingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function DjOnboardingPage({ searchParams }: DjOnboardingPageProps) {
  const [user, query] = await Promise.all([requireDjForOnboarding(), searchParams]);
  const profile = await getDjProfileForUser(user.id);
  const isEditMode = firstParam(query.edit) === "1";

  if (user.isOnboarded && profile && !isEditMode) {
    redirect("/dj/dashboard");
  }

  const error = firstParam(query.error);
  const selectedGenres = new Set(profile?.genres ?? []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_35%),radial-gradient(circle_at_85%_15%,_rgba(167,139,250,0.14),_transparent_28%),linear-gradient(140deg,_#04070b_0%,_#0a0e1a_55%,_#111326_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.12)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Nightly DJ</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{isEditMode ? "Edit your DJ profile." : "Build your DJ profile."}</h1>
          <p className="mt-4 text-base leading-7 text-zinc-300">
            {isEditMode
              ? "Update your public identity, music lane, and booking details."
              : "Set your public identity, music lane, and booking details so venues and event teams can discover you."}
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <form action={saveDjOnboarding} className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <input type="hidden" name="editMode" value={isEditMode ? "1" : "0"} />
          <section className="space-y-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Core profile</h2>

            <div>
              <label htmlFor="stageName" className="mb-2 block text-sm font-medium text-zinc-300">
                Stage name <span className="text-cyan-300">*</span>
              </label>
              <input
                id="stageName"
                name="stageName"
                required
                defaultValue={profile?.stageName ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
                placeholder="DJ Nova"
              />
            </div>

            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-zinc-300">
                Public username <span className="text-cyan-300">*</span>
              </label>
              <input
                id="username"
                name="username"
                required
                defaultValue={profile?.username ?? ""}
                pattern="[a-z0-9_-]+"
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
                placeholder="dj_nova"
              />
              <p className="mt-2 text-xs text-zinc-400">Use lowercase letters, numbers, hyphens, or underscores.</p>
            </div>

            <div>
              <label htmlFor="city" className="mb-2 block text-sm font-medium text-zinc-300">
                City <span className="text-cyan-300">*</span>
              </label>
              <input
                id="city"
                name="city"
                required
                defaultValue={profile?.city ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
                placeholder="Atlanta"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Genres <span className="text-cyan-300">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {DJ_GENRE_OPTIONS.map((genre) => (
                  <label
                    key={genre}
                    className="cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    <input
                      type="checkbox"
                      name="genres"
                      value={genre}
                      defaultChecked={selectedGenres.has(genre)}
                      className="mr-2 h-4 w-4 align-middle accent-cyan-400"
                    />
                    {genre}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-5">
            <h2 className="text-lg font-semibold text-white">Extended details</h2>

            <div>
              <label htmlFor="bio" className="mb-2 block text-sm font-medium text-zinc-300">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                defaultValue={profile?.bio ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
                placeholder="Your sound, your style, your favorite rooms."
              />
            </div>

            <div>
              <label htmlFor="profileImageUrl" className="mb-2 block text-sm font-medium text-zinc-300">
                Profile image URL
              </label>
              <input
                id="profileImageUrl"
                name="profileImageUrl"
                type="url"
                defaultValue={profile?.profileImageUrl ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
                placeholder="https://..."
              />
            </div>

            <div>
              <label htmlFor="yearsPerforming" className="mb-2 block text-sm font-medium text-zinc-300">
                Years performing
              </label>
              <input
                id="yearsPerforming"
                name="yearsPerforming"
                type="number"
                min={0}
                defaultValue={profile?.yearsPerforming ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <input
                id="isResidentDj"
                type="checkbox"
                name="isResidentDj"
                defaultChecked={profile?.isResidentDj ?? false}
                className="peer float-right mt-0.5 h-4 w-4 accent-cyan-400"
              />
              <label htmlFor="isResidentDj" className="block pr-8 text-sm font-medium text-zinc-200">
                Resident DJ
              </label>
              <div className="clear-both mt-3 hidden peer-checked:block">
                <label htmlFor="residentVenueName" className="mb-2 block text-sm font-medium text-zinc-300">
                  Resident venue name
                </label>
                <input
                  id="residentVenueName"
                  name="residentVenueName"
                  defaultValue={profile?.residentVenueName ?? ""}
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50"
                  placeholder="Venue name"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="instagramUrl" className="mb-2 block text-sm font-medium text-zinc-300">Instagram</label>
                <input id="instagramUrl" name="instagramUrl" type="url" defaultValue={profile?.instagramUrl ?? ""} className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="https://instagram.com/..." />
              </div>
              <div>
                <label htmlFor="tiktokUrl" className="mb-2 block text-sm font-medium text-zinc-300">TikTok</label>
                <input id="tiktokUrl" name="tiktokUrl" type="url" defaultValue={profile?.tiktokUrl ?? ""} className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="https://tiktok.com/@..." />
              </div>
              <div>
                <label htmlFor="soundcloudUrl" className="mb-2 block text-sm font-medium text-zinc-300">SoundCloud</label>
                <input id="soundcloudUrl" name="soundcloudUrl" type="url" defaultValue={profile?.soundcloudUrl ?? ""} className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="https://soundcloud.com/..." />
              </div>
              <div>
                <label htmlFor="websiteUrl" className="mb-2 block text-sm font-medium text-zinc-300">Website</label>
                <input id="websiteUrl" name="websiteUrl" type="url" defaultValue={profile?.websiteUrl ?? ""} className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="https://your-site.com" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bookingEmail" className="mb-2 block text-sm font-medium text-zinc-300">Booking email</label>
                <input id="bookingEmail" name="bookingEmail" type="email" defaultValue={profile?.bookingEmail ?? ""} className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="bookings@dj.com" />
              </div>
              <div>
                <label htmlFor="rateDollars" className="mb-2 block text-sm font-medium text-zinc-300">Starting rate (USD)</label>
                <input id="rateDollars" name="rateDollars" type="number" min={0} step="1" defaultValue={profile?.rateCents != null ? Math.round(profile.rateCents / 100) : ""} className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="500" />
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
              <span>
                <span className="block text-sm font-medium text-zinc-200">Available for booking</span>
                <span className="text-xs text-zinc-400">You can change this any time.</span>
              </span>
              <input
                type="checkbox"
                name="isAvailableForBooking"
                defaultChecked={profile?.isAvailableForBooking ?? true}
                className="h-4 w-4 accent-cyan-400"
              />
            </label>

            <button type="submit" className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">
              {isEditMode ? "Save changes" : "Save DJ profile"}
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}
