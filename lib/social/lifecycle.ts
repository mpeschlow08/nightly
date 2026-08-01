import type { PresenceStatus, SocialVisibility } from "./types";

export const presenceStatusLabels: Record<PresenceStatus, string> = {
  offline: "Offline",
  online: "Online",
  idle: "Idle",
  heading_out: "Heading out",
  at_venue: "At venue",
  changing_venue: "Changing venue",
  leaving: "Leaving",
  night_over: "Night over",
  hidden: "Hidden",
};

export const socialVisibilityLabels: Record<SocialVisibility, string> = {
  public: "Public",
  friends: "Friends",
  close_friends: "Close friends",
  private: "Private",
};

export const presenceStatusTones: Record<PresenceStatus, string> = {
  offline: "border-zinc-300/20 bg-zinc-700/20 text-zinc-200",
  online: "border-cyan-300/25 bg-cyan-500/15 text-cyan-100",
  idle: "border-sky-300/25 bg-sky-500/15 text-sky-100",
  heading_out: "border-fuchsia-300/25 bg-fuchsia-500/15 text-fuchsia-100",
  at_venue: "border-emerald-300/25 bg-emerald-500/15 text-emerald-100",
  changing_venue: "border-amber-300/25 bg-amber-500/15 text-amber-100",
  leaving: "border-violet-300/25 bg-violet-500/15 text-violet-100",
  night_over: "border-slate-300/25 bg-slate-500/15 text-slate-100",
  hidden: "border-zinc-300/20 bg-zinc-700/20 text-zinc-200",
};
