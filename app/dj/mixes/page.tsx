import Link from "next/link";

import {
  deleteDjMixAction,
  featureDjMixAction,
  toggleDjMixPublicAction,
  updateDjMixDetailsAction,
} from "./actions";
import { getDjMixesForProfile, requireDjProfileForDashboard } from "../lib/data";

type DjMixesPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function DjMixesPage({ searchParams }: DjMixesPageProps) {
  const [{ profile }, params] = await Promise.all([requireDjProfileForDashboard(), searchParams]);
  const mixes = await getDjMixesForProfile(profile.id);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">DJ Mixes</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Manage your sample mixes</h1>
            <p className="mt-2 text-sm text-zinc-300">Feature, edit, and publish mixes for your profile.</p>
          </div>
          <Link
            href="/dj/mixes/new"
            className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Upload new mix
          </Link>
        </div>

        {params.success ? (
          <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {params.success}
          </div>
        ) : null}
        {params.error ? (
          <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {params.error}
          </div>
        ) : null}

        {mixes.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
            <p className="text-base font-medium text-white">No sample mixes uploaded yet.</p>
            <p className="mt-2">Upload your first mix to showcase your sound.</p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4">
            {mixes.map((mix) => (
              <article key={mix.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{mix.title}</h2>
                    <p className="mt-1 text-sm text-zinc-300">{mix.description ?? "No description"}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {mix.isFeatured ? (
                        <span className="rounded-full border border-violet-300/40 bg-violet-500/20 px-2.5 py-1 text-violet-100">Featured</span>
                      ) : null}
                      <span className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2.5 py-1 text-cyan-100">
                        {mix.isPublic ? "Public" : "Private"}
                      </span>
                      {mix.genre ? (
                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-zinc-200">{mix.genre}</span>
                      ) : null}
                    </div>
                  </div>

                  <a
                    href={mix.audioUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    Open audio
                  </a>
                </div>

                <audio controls preload="none" className="mt-4 w-full">
                  <source src={mix.audioUrl} />
                  Your browser does not support the audio player.
                </audio>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
                  <form action={updateDjMixDetailsAction} className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
                    <input type="hidden" name="mixId" value={mix.id} />
                    <div className="sm:col-span-1">
                      <label htmlFor={`title-${mix.id}`} className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-400">
                        Title
                      </label>
                      <input
                        id={`title-${mix.id}`}
                        name="title"
                        defaultValue={mix.title}
                        required
                        className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor={`genre-${mix.id}`} className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-400">
                        Genre
                      </label>
                      <input
                        id={`genre-${mix.id}`}
                        name="genre"
                        defaultValue={mix.genre ?? ""}
                        className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor={`description-${mix.id}`} className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-400">
                        Description
                      </label>
                      <input
                        id={`description-${mix.id}`}
                        name="description"
                        defaultValue={mix.description ?? ""}
                        className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="sm:col-span-3 flex justify-end">
                      <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-100">
                        Save details
                      </button>
                    </div>
                  </form>

                  <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <form action={featureDjMixAction}>
                      <input type="hidden" name="mixId" value={mix.id} />
                      <button type="submit" className="w-full rounded-full border border-violet-300/40 bg-violet-500/15 px-4 py-2 text-xs text-violet-100">
                        {mix.isFeatured ? "Featured mix" : "Feature this mix"}
                      </button>
                    </form>

                    <form action={toggleDjMixPublicAction}>
                      <input type="hidden" name="mixId" value={mix.id} />
                      <input type="hidden" name="isPublic" value={mix.isPublic ? "false" : "true"} />
                      <button type="submit" className="w-full rounded-full border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-100">
                        {mix.isPublic ? "Set private" : "Set public"}
                      </button>
                    </form>

                    <form action={deleteDjMixAction}>
                      <input type="hidden" name="mixId" value={mix.id} />
                      <button type="submit" className="w-full rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
                        Delete mix
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
