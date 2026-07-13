"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import type { Crew, CrewVoteOption } from "@/data/crews";

type Props = {
  crew: Crew;
};

export default function CrewDetailClient({ crew }: Props) {
  const [copied, setCopied] = useState(false);
  const [rsvp, setRsvp] = useState<"going" | "maybe" | "cant">("going");
  const [voteOptions, setVoteOptions] = useState<CrewVoteOption[]>(crew.voteOptions);
  const [selectedVote, setSelectedVote] = useState(crew.voteOptions[0].id);

  const totalVotes = useMemo(() => voteOptions.reduce((sum, option) => sum + option.votes, 0), [voteOptions]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(crew.inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const shareInvite = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: `${crew.name} invite`, text: `Join ${crew.name} on Nightly`, url: crew.inviteLink });
      return;
    }

    await handleCopy();
  };

  const handleVote = (id: string) => {
    setSelectedVote(id);
    setVoteOptions((current) => current.map((option) => (option.id === id ? { ...option, votes: option.votes + 1 } : option)));
  };

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />
        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className={`h-20 w-20 rounded-[1.4rem] bg-gradient-to-br ${crew.gradient}`} />
                <p className="mt-5 text-sm uppercase tracking-[0.35em] text-cyan-300/80">Crew</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {crew.name}
                </h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">{crew.description}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleCopy} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                  {copied ? "Copied" : "Copy invite"}
                </button>
                <button type="button" onClick={shareInvite} className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
                  Share invite
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Invite link</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input readOnly value={crew.inviteLink} className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-zinc-200 outline-none" />
                  <button type="button" onClick={handleCopy} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Members</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {crew.members.map((member) => (
                    <div key={member.name} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${member.accent} text-xs font-semibold text-white`}>
                        {member.initials}
                      </span>
                      {member.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Upcoming plan</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{crew.upcomingPlan.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{crew.upcomingPlan.note}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-zinc-200">{crew.upcomingPlan.time}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-zinc-200">{crew.upcomingPlan.venue}</span>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(139,92,246,0.12)] backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">RSVP</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    { key: "going", label: "Going" },
                    { key: "maybe", label: "Maybe" },
                    { key: "cant", label: "Can't Go" },
                  ].map((option) => {
                    const active = rsvp === option.key;
                    return (
                      <button key={option.key} type="button" onClick={() => setRsvp(option.key as typeof rsvp)} className={`rounded-full px-4 py-2 text-sm transition ${active ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "border border-white/10 bg-white/5 text-zinc-300 hover:border-cyan-400/30"}`}>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">Current vibe</p>
                  <p className="mt-1">{crew.rsvpCount} confirmed for the night so far.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Venue voting</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Pick the final stop</h2>
                  </div>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">{totalVotes} votes</span>
                </div>

                <div className="mt-5 space-y-3">
                  {voteOptions.map((option) => {
                    const active = selectedVote === option.id;
                    return (
                      <button key={option.id} type="button" onClick={() => handleVote(option.id)} className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${active ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:border-cyan-400/30"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">{option.venueName}</p>
                            <p className="mt-1 text-sm text-zinc-400">{option.votes} vote{option.votes === 1 ? "" : "s"}</p>
                          </div>
                          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-zinc-200">
                            {option.votes}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(139,92,246,0.12)] backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Suggested venues</p>
                <div className="mt-4 space-y-3">
                  {crew.voteOptions.map((choice) => (
                    <div key={choice.id} className="flex items-center justify-between rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      <span className="font-medium text-white">{choice.venueName}</span>
                      <Link href={`/venues/${choice.slug}`} className="text-cyan-200 transition hover:text-cyan-100">
                        View venue
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Activity feed</p>
            <div className="mt-5 space-y-3">
              {crew.activityFeed.map((item) => (
                <div key={item.text} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">{item.text}</p>
                  <p className="mt-1 text-zinc-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
