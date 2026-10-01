import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getSocialActor } from "../../lib/auth";
import { db } from "@/db";
import { nightOutPlanMembers, nightOutPlans, nightOutPlanStops, socialProfiles, venues } from "@/db/schema";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getSocialActor();
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isSafeInteger(planId) || planId <= 0) notFound();

  const [plan] = await db.select().from(nightOutPlans).where(eq(nightOutPlans.id, planId)).limit(1);
  const [membership] = await db.select({ userId: nightOutPlanMembers.userId }).from(nightOutPlanMembers).where(and(eq(nightOutPlanMembers.planId, planId), eq(nightOutPlanMembers.userId, actor.userId))).limit(1);
  if (!plan || (plan.creatorUserId !== actor.userId && !membership)) notFound();

  const [stops, members] = await Promise.all([
    db.select({ id: nightOutPlanStops.id, title: nightOutPlanStops.title, venueName: venues.name, arrivalWindow: nightOutPlanStops.arrivalWindow }).from(nightOutPlanStops).leftJoin(venues, eq(venues.id, nightOutPlanStops.venueId)).where(eq(nightOutPlanStops.planId, planId)),
    db.select({ userId: nightOutPlanMembers.userId, rsvpStatus: nightOutPlanMembers.rsvpStatus, displayName: socialProfiles.displayName, handle: socialProfiles.handle }).from(nightOutPlanMembers).leftJoin(socialProfiles, eq(socialProfiles.userId, nightOutPlanMembers.userId)).where(eq(nightOutPlanMembers.planId, planId)),
  ]);

  return (
    <main className="nightly-page mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/crews/plans" className="text-sm text-[color:var(--text-secondary)] hover:text-white">Back to Plans</Link>
      <section className="nightly-card-hero mt-4 rounded-[1.7rem] p-5 sm:p-7">
        <p className="nightly-eyebrow">Plan detail</p>
        <h1 className="nightly-display nightly-accent-heading mt-2">{plan.title}</h1>
        <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{plan.description ?? "Keep the night simple and visible to the people invited."}</p>
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">{plan.startsAt?.toLocaleString() ?? "Time flexible"}</p>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="nightly-surface p-5"><p className="nightly-eyebrow">Where</p><h2 className="nightly-section-title mt-2">Destination</h2><div className="mt-4 space-y-2">{stops.length === 0 ? <p className="text-sm text-[color:var(--text-secondary)]">No destination yet.</p> : stops.map((stop) => <div key={stop.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-medium text-white">{stop.venueName ?? stop.title}</p><p className="mt-1 text-xs text-[color:var(--text-muted)]">{stop.arrivalWindow ?? "Arrival window flexible"}</p></div>)}</div></section>
        <section className="nightly-surface p-5"><p className="nightly-eyebrow">Who&apos;s coming</p><h2 className="nightly-section-title mt-2">Attendees</h2><div className="mt-4 space-y-2">{members.map((member) => <div key={member.userId} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3"><div><p className="font-medium text-white">{member.displayName ?? "Nightly friend"}</p><p className="text-xs text-[color:var(--text-muted)]">{member.handle ?? "@nightly"}</p></div><span className="nightly-badge">{member.rsvpStatus}</span></div>)}</div></section>
      </div>
    </main>
  );
}
