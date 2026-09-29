import Link from "next/link";

import { requireDjProfileForDashboard } from "@/app/dj/lib/data";
import { getArtistSessions, getSessionMedia, getSessionSources, listSessionVenues } from "@/lib/artist-sessions/service";
import { checkInForSet, endMySet, reviewSetMoment, setMicrophonePreference, startMySet } from "./actions";

export default async function DjSessionsPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { user, profile } = await requireDjProfileForDashboard();
  const actor = { userId: user.id, djProfileId: profile.id };
  const [sessions, venues, query] = await Promise.all([getArtistSessions(actor), listSessionVenues(), searchParams]);
  const selected = sessions.find((session) => session.publicId === query.session) ?? sessions.find((session) => session.status === "active") ?? null;
  const [sources, media] = selected ? await Promise.all([getSessionSources(actor, selected.id), getSessionMedia(actor, selected.id)]) : [[], []];
  const counts = { camera: sources.filter((item) => item.role === "camera").length,
    program: sources.filter((item) => item.role === "program_audio").length,
    ambient: sources.filter((item) => item.role === "ambient_audio").length };

  return <main className="min-h-screen bg-[#080b12] px-4 py-8 text-zinc-100 sm:px-6">
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase text-cyan-300">Tonight</p>
        <h1 className="mt-2 text-3xl font-semibold">Your set</h1></div><Link href="/dj/dashboard" className="text-sm text-zinc-400 hover:text-white">Dashboard</Link></header>
      {selected ? <section className="space-y-6 border-t border-white/10 pt-6">
        <div><p className="text-sm text-cyan-300">{selected.status === "active" ? "You're live" : selected.status === "ready" ? "Ready to play" : "Set complete"}</p>
          <h2 className="mt-2 text-2xl font-semibold">{selected.venueName}</h2>
          <p className="mt-1 text-sm text-zinc-400">{selected.startedAt ? `Started ${selected.startedAt.toLocaleTimeString()}` : "Check-in confirmed"}</p></div>
        {selected.status === "active" ? <>
          <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-5 text-sm"><span>Cameras {counts.camera ? "✓" : "—"}</span><span>Mixer {counts.program ? "✓" : "—"}</span><span>Crowd {counts.ambient ? "✓" : "—"}</span></div>
          <form action={setMicrophonePreference} className="flex items-center justify-between gap-4"><input type="hidden" name="sessionId" value={selected.publicId} />
            <label htmlFor="microphone" className="text-sm">Include microphone / voice-over</label>
            <input id="microphone" name="includeMicrophone" type="checkbox" defaultChecked={selected.includeMicrophone} onChange={undefined} className="h-5 w-5 accent-cyan-400" />
            <button type="submit" className="text-sm text-cyan-300">Save</button></form>
          <form action={endMySet}><input type="hidden" name="sessionId" value={selected.publicId} /><button type="submit" className="w-full rounded border border-white/20 px-5 py-3 text-sm font-medium hover:bg-white/10">End set</button></form>
        </> : selected.status === "ready" ? <form action={startMySet}><input type="hidden" name="sessionId" value={selected.publicId} /><button type="submit" className="w-full rounded bg-cyan-400 px-5 py-3 font-semibold text-black hover:bg-cyan-300">Start my set</button></form> : null}
        {selected.status !== "ready" ? <section className="space-y-3 border-t border-white/10 pt-5"><h3 className="text-sm font-medium">Set moments</h3>
          {media.length ? media.map((moment) => <article key={moment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3">
            <div><p className="text-sm">{moment.start.toLocaleTimeString()}</p>
              <p className="text-xs text-zinc-400">{moment.reviewState === "available" ? "Ready to review" : moment.reviewState === "approved" ? "Approved" : moment.reviewState === "hidden" ? "Hidden" : "Preparing"}</p></div>
            {moment.reviewState === "available" ? <div className="flex gap-2">
              {(["approved", "hidden"] as const).map((reviewState) => <form key={reviewState} action={reviewSetMoment}>
                <input type="hidden" name="sessionId" value={selected.publicId} />
                <input type="hidden" name="mediaId" value={moment.id} />
                <input type="hidden" name="reviewState" value={reviewState} />
                <button type="submit" className="rounded border border-white/15 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">{reviewState === "approved" ? "Approve" : "Hide"}</button>
              </form>)}
            </div> : null}
          </article>) : <p className="text-sm text-zinc-400">No moments linked to this set yet.</p>}
        </section> : null}
      </section> : null}
      {!sessions.some((item) => item.status === "active") && <section className="space-y-4 border-t border-white/10 pt-6"><h2 className="text-lg font-medium">Choose a venue</h2>
        {venues.length ? venues.map((venue) => <form key={venue.id} action={checkInForSet} className="flex items-center justify-between gap-4 border-b border-white/10 py-3">
          <div><p className="font-medium">{venue.name}</p><p className="text-sm text-zinc-400">{venue.city ?? "Nightly ready"}</p></div>
          <input type="hidden" name="venueId" value={venue.id} /><button type="submit" className="rounded border border-cyan-300/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">Check in</button>
        </form>) : <p className="text-sm text-zinc-400">No Nightly-ready venues are available right now.</p>}</section>}
      {sessions.some((session) => session.status === "ended") && <section className="border-t border-white/10 pt-6"><h2 className="text-lg font-medium">Past sets</h2><div className="mt-3 space-y-2">
        {sessions.filter((session) => session.status === "ended").map((session) => <Link key={session.id} href={`/dj/sessions?session=${session.publicId}`} className="block py-2 text-sm text-zinc-300 hover:text-white">{session.venueName} · {session.startedAt?.toLocaleDateString()}</Link>)}</div></section>}
    </div>
  </main>;
}