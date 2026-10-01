import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { artistPerformanceSessions, artistSessionSources, djProfiles, venues } from "@/db/schema";
import { getCurrentVenueDeviceActor } from "@/lib/nightly-device/auth";
import { canViewOperationalSessions } from "@/lib/artist-sessions/policy";
import { expireStaleVenueSessions } from "@/lib/artist-sessions/service";

export default async function OwnerSessionsPage() {
  const actor = await getCurrentVenueDeviceActor();
  if (!actor || actor.venueId === null || !canViewOperationalSessions(actor, actor.venueId)) notFound();
  await expireStaleVenueSessions(actor.venueId);
  const [venue] = await db.select({ id: venues.id, name: venues.name }).from(venues).where(eq(venues.id, actor.venueId)).limit(1);
  if (!venue) notFound();
  const sessions = await db.select({ id: artistPerformanceSessions.id, publicId: artistPerformanceSessions.publicId,
    status: artistPerformanceSessions.status, startedAt: artistPerformanceSessions.startedAt,
    endedAt: artistPerformanceSessions.endedAt, includeMicrophone: artistPerformanceSessions.includeMicrophone,
    stageName: djProfiles.stageName }).from(artistPerformanceSessions)
    .innerJoin(djProfiles, eq(djProfiles.id, artistPerformanceSessions.djProfileId))
    .where(eq(artistPerformanceSessions.venueId, venue.id))
    .orderBy(desc(artistPerformanceSessions.createdAt)).limit(20);
  const sources = sessions.length ? await db.select({ sessionId: artistSessionSources.sessionId, role: artistSessionSources.role })
    .from(artistSessionSources).where(inArray(artistSessionSources.sessionId, sessions.map((session) => session.id))) : [];
  const rolesBySession = new Map<number, Set<string>>();
  for (const source of sources) {
    const roles = rolesBySession.get(source.sessionId) ?? new Set<string>();
    roles.add(source.role);
    rolesBySession.set(source.sessionId, roles);
  }
  return <main className="nightly-page min-h-screen px-4 py-6 text-zinc-100 sm:px-6"><div className="mx-auto max-w-4xl space-y-8">
    <header className="nightly-card-hero rounded-[1.7rem] p-5"><div><p className="nightly-eyebrow">VenueOS / Artist Sessions</p>
      <h1 className="nightly-display nightly-accent-heading mt-2">DJ sessions</h1><p className="mt-2 text-sm text-zinc-400">{venue.name}</p></div>
      <Link href="/owner/dashboard" className="text-sm text-zinc-400 hover:text-white">Dashboard</Link></header>
    <section><h2 className="text-lg font-medium">Recent sets</h2><div className="mt-4 divide-y divide-white/10">
      {sessions.map((session) => {
        const roles = rolesBySession.get(session.id) ?? new Set<string>();
        return <article key={session.id} className="space-y-3 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-medium">{session.stageName}</h3>
            <span className="text-sm text-zinc-400">{session.status === "active" ? "Live" : session.endedAt ? "Ended" : "Checked in"}</span></div>
          <p className="text-sm text-zinc-400">{session.startedAt ? `Started ${session.startedAt.toLocaleTimeString()}` : "Not started"}
            {session.endedAt ? ` · Ended ${session.endedAt.toLocaleTimeString()}` : ""}</p>
          <div className="flex flex-wrap gap-5 text-sm"><span>Cameras {roles.has("camera") ? "✓" : "—"}</span>
            <span>Mixer {roles.has("program_audio") ? "✓" : "—"}</span>
            <span>Crowd {roles.has("ambient_audio") ? "✓" : "—"}</span>
            <span>Microphone {session.includeMicrophone ? "Included" : "Off"}</span></div>
        </article>;
      })}
      {!sessions.length ? <p className="py-4 text-sm text-zinc-400">Sessions will appear here when a DJ checks in.</p> : null}
    </div></section>
  </div></main>;
}