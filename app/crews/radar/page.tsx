import Link from "next/link";

import { stopLocationSharingAction } from "../actions";
import { getFriendRadarData } from "@/lib/social/radar";

function statusLabel(status: string, precision: string) {
  if (precision === "not_sharing") return "Not sharing";
  if (precision === "unavailable") return "Location unavailable";
  if (status === "stale") return "Offline or stale";
  if (status === "at_venue") return "At venue";
  if (status === "heading_out") return "Approaching";
  if (status === "at_home") return "At home";
  return status.replaceAll("_", " ");
}

export default async function FriendRadarPage() {
  const radar = await getFriendRadarData();

  return (
    <main className="nightly-page mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/crews" className="text-sm text-[color:var(--text-secondary)] hover:text-white">Back to Link Up</Link>
      <section className="nightly-card-hero mt-4 rounded-[1.7rem] p-5 sm:p-7">
        <p className="nightly-eyebrow">Friend Radar</p>
        <h1 className="nightly-display nightly-accent-heading mt-2">Where is your group tonight?</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Only the precision your friends chose to share appears here. Nightly never turns presence into a raw-coordinate feed.</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="nightly-badge">Your sharing: {radar.sharingMode.replaceAll("_", " ")}</span>
          <form action={stopLocationSharingAction}><button type="submit" className="nightly-btn-secondary min-h-10 rounded-full px-3 text-xs">Stop sharing</button></form>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {radar.friends.length === 0 ? <div className="nightly-surface p-6 text-sm text-[color:var(--text-secondary)] sm:col-span-2 lg:col-span-3">No friends are sharing a current location yet. Add friends through Friend Code or QR to see your group here.</div> : null}
        {radar.friends.map((friend) => (
          <article key={friend.userId} className="nightly-card rounded-[1.25rem] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-base font-semibold text-white">{friend.displayName ?? "Nightly friend"}</h2><p className="mt-1 text-xs text-[color:var(--text-muted)]">{friend.handle ?? "@nightly"}</p></div>
              <span className="nightly-badge">{friend.precision}</span>
            </div>
            <p className="mt-5 text-lg font-medium capitalize text-[color:var(--text-primary)]">{statusLabel(friend.status, friend.precision)}</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{friend.venueName ?? friend.approximateLocationLabel ?? "No place shared"}</p>
            <p className="mt-4 text-xs text-[color:var(--text-muted)]">Last seen {new Date(friend.lastSeenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
