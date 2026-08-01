import { randomUUID } from "node:crypto";

import Link from "next/link";

import { createScanSessionAction, scanTicketAction } from "@/app/tickets/actions";
import { requireDoorStaffTicketActor } from "@/app/tickets/lib/auth";
import { getDoorDashboard } from "@/app/tickets/lib/data";
import { getUpcomingEvents } from "@/lib/consumer/data";
import { getScanDecisionLabel } from "@/lib/ticketing/lifecycle";

export default async function DoorPage({ searchParams }: { searchParams?: { eventId?: string; sessionToken?: string; scanDecision?: string; scanReason?: string } }) {
  const actor = await requireDoorStaffTicketActor();
  const upcomingEvents = await getUpcomingEvents(8);
  const eventId = typeof searchParams?.eventId === "string" ? Number(searchParams.eventId) : Number.NaN;
  const sessionToken = typeof searchParams?.sessionToken === "string" ? searchParams.sessionToken : null;
  const scanDecision = typeof searchParams?.scanDecision === "string" ? searchParams.scanDecision : null;
  const scanReason = typeof searchParams?.scanReason === "string" ? searchParams.scanReason : null;
  const dashboard = Number.isFinite(eventId) ? await getDoorDashboard(eventId) : null;

  return (
    <section className="space-y-6">
      <header className="rounded-[1.7rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_70px_rgba(8,145,178,0.12)] backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Door Operations</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Session-based scan and check-in</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          Start a short-lived scan session, validate signed ticket tokens, and keep every decision attached to an auditable event log.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Role: {actor.role}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Session: {sessionToken ? "active" : "not started"}</span>
        </div>
      </header>

      {scanDecision || scanReason ? (
        <section className="rounded-[1.7rem] border border-cyan-400/20 bg-cyan-500/10 p-5 text-sm text-cyan-50">
          <p className="font-semibold uppercase tracking-[0.24em] text-cyan-100">Latest scan</p>
          <p className="mt-2">Decision: {scanDecision ?? "unknown"}</p>
          <p className="mt-1 text-cyan-100/80">{scanReason ?? "No scan reason provided."}</p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Start Session</p>
          <form action={createScanSessionAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Event</span>
              <select name="eventId" defaultValue={Number.isFinite(eventId) ? String(eventId) : ""} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50">
                <option value="">Select event</option>
                {upcomingEvents.map((event) => (
                  <option key={event.id} value={event.id}>{event.name} • {event.venueName}</option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Device label</span>
              <input name="deviceLabel" placeholder="Front door scanner" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50" />
            </label>
            <button type="submit" className="sm:col-span-2 rounded-full border border-cyan-400/30 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30">
              Start scan session
            </button>
          </form>
        </article>

        <article className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Live Session</p>
          {sessionToken ? (
            <>
              <p className="mt-4 break-all rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-200">{sessionToken}</p>
              <form action={scanTicketAction} className="mt-4 space-y-4">
                <input type="hidden" name="sessionToken" value={sessionToken} />
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Ticket token</span>
                  <input name="token" placeholder="Paste signed token string" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Zone</span>
                  <input name="zone" placeholder="Main floor" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50" />
                </label>
                <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                <button type="submit" className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
                  Scan ticket
                </button>
              </form>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">Start a session to enable scans.</p>
          )}
        </article>
      </section>

      <section className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Dashboard</p>
        {dashboard ? (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <article className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4"><p className="text-xs text-zinc-400">Total</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.counts.totalTickets}</p></article>
              <article className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4"><p className="text-xs text-zinc-400">Checked in</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.counts.checkedIn}</p></article>
              <article className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4"><p className="text-xs text-zinc-400">Partial</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.counts.partial}</p></article>
              <article className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4"><p className="text-xs text-zinc-400">Voided</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.counts.voided}</p></article>
              <article className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4"><p className="text-xs text-zinc-400">Issued</p><p className="mt-2 text-2xl font-semibold text-white">{dashboard.counts.issued}</p></article>
            </div>
            <div className="mt-6 space-y-3">
              {dashboard.scans.map((scan) => (
                <article key={scan.id} className="rounded-2xl border border-white/10 bg-zinc-950/65 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{scan.scanToken}</p>
                    <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">{getScanDecisionLabel(scan.decision as never)}</p>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">{scan.reason ?? "No reason recorded"}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">Pick an event to view live metrics.</p>
        )}
      </section>

      <section className="rounded-[1.7rem] border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Quick links</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/tickets" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
            Ticket hub
          </Link>
          <Link href="/owner" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
            Owner dashboard
          </Link>
        </div>
      </section>
    </section>
  );
}
