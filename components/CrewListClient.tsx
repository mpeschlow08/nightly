"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import CreateCrewModal from "@/components/CreateCrewModal";
import CrewCard from "@/components/CrewCard";
import { initialCrews, type Crew } from "@/data/crews";

type Props = {
  selectedVenue?: string;
};

export default function CrewListClient({ selectedVenue }: Props) {
  const [crews, setCrews] = useState<Crew[]>(initialCrews);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedVenueLabel = useMemo(() => {
    return selectedVenue ? `Planning around ${selectedVenue}` : "Planning something special";
  }, [selectedVenue]);

  const handleCreateCrew = (crew: Crew) => {
    setCrews((current) => [crew, ...current]);
  };

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.18),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Crews</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Your Crews
                </h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Plan the night together with a shared invite link, venue votes, and a clean RSVP flow.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setModalOpen(true)} className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
                  Create a Crew
                </button>
                <Link href="/discover" className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
                  Browse venues
                </Link>
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
              <p className="font-medium text-white">{selectedVenueLabel}</p>
              <p className="mt-1 text-zinc-400">Create a shared plan, invite friends by link, and keep the group aligned without the messaging chaos.</p>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {crews.map((crew) => (
              <CrewCard key={crew.id} crew={crew} />
            ))}
          </section>
        </main>
      </div>

      <CreateCrewModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreateCrew} suggestedVenue={selectedVenue} />
    </div>
  );
}
