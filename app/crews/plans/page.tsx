import Link from "next/link";

import { desc, eq, or } from "drizzle-orm";
import { createNightOutPlanAction } from "../actions";
import { getSocialActor } from "../lib/auth";
import { db } from "@/db";
import { nightOutPlanMembers, nightOutPlans } from "@/db/schema";

export default async function PlansPage() {
  const actor = await getSocialActor();
  const plans = await db
    .select({ id: nightOutPlans.id, title: nightOutPlans.title, description: nightOutPlans.description, startsAt: nightOutPlans.startsAt, creatorUserId: nightOutPlans.creatorUserId })
    .from(nightOutPlans)
    .leftJoin(nightOutPlanMembers, eq(nightOutPlanMembers.planId, nightOutPlans.id))
    .where(or(eq(nightOutPlans.creatorUserId, actor.userId), eq(nightOutPlanMembers.userId, actor.userId)))
    .orderBy(desc(nightOutPlans.startsAt), desc(nightOutPlans.createdAt));

  return (
    <main className="nightly-page mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="nightly-card-hero rounded-[1.7rem] p-5 sm:p-7">
        <p className="nightly-eyebrow">Plans</p>
        <h1 className="nightly-display nightly-accent-heading mt-2">Where, when, who&apos;s coming?</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Make a simple plan for the night, then invite the people who should be there.</p>
      </section>

      <section className="mt-5 nightly-surface p-5 sm:p-6">
        <h2 className="nightly-section-title">Create a plan</h2>
        <form action={createNightOutPlanAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="title" required placeholder="Friday night out" className="nightly-control" />
          <input name="startsAt" type="datetime-local" className="nightly-control" />
          <textarea name="description" placeholder="Optional note" rows={2} className="nightly-control sm:col-span-2" />
          <button type="submit" className="nightly-btn-primary min-h-11 rounded-full px-5 text-sm sm:col-span-2">Create plan</button>
        </form>
      </section>

      <section className="mt-6 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="nightly-eyebrow">Your night</p><h2 className="nightly-section-title mt-1">Plans</h2></div>
          <span className="nightly-badge">{plans.length} saved</span>
        </div>
        {plans.length === 0 ? (
          <div className="nightly-surface p-6 text-sm text-[color:var(--text-secondary)]">No plans yet. Create one when you know the destination.</div>
        ) : plans.map((plan) => (
          <Link key={plan.id} href={`/crews/plans/${plan.id}`} className="nightly-card nightly-card-interactive block rounded-[1.2rem] p-4">
            <div className="flex items-start justify-between gap-3"><h3 className="text-base font-semibold text-white">{plan.title}</h3><span className="text-xs text-[color:var(--text-muted)]">{plan.startsAt?.toLocaleString() ?? "Time flexible"}</span></div>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{plan.description ?? "A Nightly plan is ready for friends."}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
