"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { Crew } from "@/data/crews";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (crew: Crew) => void;
  suggestedVenue?: string;
};

const defaultGenres = "House, EDM";

export default function CreateCrewModal({ open, onClose, onCreate, suggestedVenue }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genres, setGenres] = useState(defaultGenres);
  const [inviteLink, setInviteLink] = useState("");

  const generatedLink = useMemo(() => {
    const trimmed = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slug = trimmed || "new-crew";
    const venueSuffix = suggestedVenue ? `?venue=${encodeURIComponent(suggestedVenue)}` : "";
    return `https://nightly.app/invite/${slug}${venueSuffix}`;
  }, [name, suggestedVenue]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !description.trim()) {
      return;
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const genreList = genres
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    onCreate({
      id: Date.now(),
      slug,
      name: name.trim(),
      description: description.trim(),
      gradient: "from-cyan-500/80 via-violet-500/70 to-fuchsia-500/80",
      memberCount: 4,
      nextNight: "Tonight • 10:30 PM",
      rsvpCount: 3,
      recentActivity: "Created just now.",
      members: [
        { name: "You", initials: "YO", accent: "from-cyan-500 to-violet-500" },
        { name: "Mia", initials: "MI", accent: "from-fuchsia-500 to-violet-500" },
      ],
      inviteLink: inviteLink.trim() || generatedLink,
      genres: genreList.length > 0 ? genreList : ["House"],
      upcomingPlan: {
        title: "First meetup",
        time: "Tonight",
        venue: suggestedVenue ?? "A nearby lounge",
        note: "A new group plan is ready to share.",
      },
      voteOptions: [
        { id: "choice-1", venueName: suggestedVenue ?? "District Atlanta", votes: 1, slug: "district-atlanta" },
        { id: "choice-2", venueName: "Tongue & Groove", votes: 0, slug: "tongue-and-groove" },
        { id: "choice-3", venueName: "Rose Bar", votes: 0, slug: "rose-bar" },
      ],
      activityFeed: [{ text: "Crew created", detail: "Just now" }],
    });

    setName("");
    setDescription("");
    setGenres(defaultGenres);
    setInviteLink("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950/95 p-6 shadow-[0_0_100px_rgba(34,211,238,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Start a crew</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Create a new crew</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:text-white">
            Close
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Crew name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} required className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" placeholder="Weekend Crew" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={3} className="w-full rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" placeholder="Keep the plan simple and stylish." />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Preferred music genres</label>
            <input value={genres} onChange={(event) => setGenres(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" placeholder="House, EDM" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Invite link</label>
            <input value={inviteLink || generatedLink} onChange={(event) => setInviteLink(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:text-white">
              Cancel
            </button>
            <button type="submit" className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
              Create Crew
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
