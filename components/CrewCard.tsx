import Link from "next/link";

import type { Crew } from "@/data/crews";
export default function CrewCard({ crew }: { crew: Crew }) {
  return (
    <article className="flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_70px_rgba(34,211,238,0.07)] backdrop-blur-xl">
      <div className={`h-20 rounded-[1.25rem] bg-gradient-to-br ${crew.gradient}`} />
      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{crew.name}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{crew.description}</p>
          </div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
            {crew.memberCount} members
          </span>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-zinc-400">Next planned night</p>
            <p className="mt-1 font-medium text-white">{crew.nextNight}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-zinc-400">RSVPs</p>
            <p className="mt-1 font-medium text-white">{crew.rsvpCount}/{crew.memberCount}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
          <p className="text-zinc-400">Recent activity</p>
          <p className="mt-1 font-medium text-white">{crew.recentActivity}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/crews/${crew.slug}`} className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
            Open Crew
          </Link>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
            {crew.genres.join(" • ")}
          </span>
        </div>
      </div>
    </article>
  );
}
