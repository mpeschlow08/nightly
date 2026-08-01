import Link from "next/link";
import { notFound } from "next/navigation";

import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import BookingTimeline from "@/components/bookings/BookingTimeline";
import { getAllowedBookingTransitions, bookingTypeLabels } from "@/lib/bookings/lifecycle";
import { getBookingActor } from "../lib/auth";
import { getBookingById } from "../lib/data";
import { transitionBookingStatusAction, submitBookingCounterOfferAction } from "../actions";

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString() : "Not set";
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId)) {
    notFound();
  }

  const actor = await getBookingActor();
  const payload = await getBookingById(bookingId, actor);

  if (!payload.booking || !payload.isAccessible) {
    notFound();
  }

  const allowedTransitions = getAllowedBookingTransitions(payload.booking.lifecycleStatus);
  const canTransition = actor.role !== "consumer";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-zinc-400">Booking detail</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">{payload.booking.bookingNumber}</h1>
              <p className="mt-2 text-sm text-zinc-300">{bookingTypeLabels(payload.booking.bookingType)} • {payload.booking.city ?? "City not set"}</p>
            </div>
            <BookingStatusBadge status={payload.booking.lifecycleStatus} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Start</p>
              <p className="mt-2 text-base text-white">{formatDate(payload.booking.requestedStartAt)}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">End</p>
              <p className="mt-2 text-base text-white">{formatDate(payload.booking.requestedEndAt)}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Budget</p>
              <p className="mt-2 text-base text-white">{formatCurrency(payload.booking.budgetCents)}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Total</p>
              <p className="mt-2 text-base text-white">{formatCurrency(payload.booking.totalCents)}</p>
            </article>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Timeline</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Venue</p>
                  <p className="mt-2 text-white">{payload.booking.venueName ?? "Not selected"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">DJ</p>
                  <p className="mt-2 text-white">{payload.booking.djName ?? "Not selected"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Deposits</p>
                  <p className="mt-2 text-white">{formatCurrency(payload.booking.depositRequiredCents)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Payout</p>
                  <p className="mt-2 text-white">{formatCurrency(payload.booking.payoutCents)}</p>
                </div>
              </div>

              {payload.booking.notes ? <p className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-300">{payload.booking.notes}</p> : null}
              <div className="mt-4">
                <BookingTimeline
                  entries={payload.history.map((entry) => ({
                    id: entry.id,
                    fromStatus: entry.fromStatus,
                    toStatus: entry.toStatus,
                    actorRole: entry.actorRole,
                    actorClerkUserId: entry.actorClerkUserId,
                    note: entry.note,
                    createdAtIso: entry.createdAt.toISOString(),
                  }))}
                />
              </div>
            </article>

            <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Messages</p>
              <div className="mt-4 space-y-3">
                {payload.messages.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-400">No messages yet.</p>
                ) : (
                  payload.messages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{message.senderRole} • {message.messageType}</p>
                      <p className="mt-2 text-sm text-zinc-200">{message.body}</p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>

          <aside className="space-y-6">
            {canTransition ? (
              <form action={transitionBookingStatusAction} className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 space-y-4">
                <input type="hidden" name="bookingId" value={payload.booking.id} />
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Management</p>
                <h2 className="text-2xl font-semibold text-white">Advance status</h2>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Next status</span>
                  <select name="nextStatus" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none">
                    {allowedTransitions.map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Note</span>
                  <textarea name="note" rows={3} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none" />
                </label>
                <button type="submit" className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300">
                  Update status
                </button>
              </form>
            ) : null}

            {(actor.role === "dj" || actor.role === "owner" || actor.role === "admin") && allowedTransitions.includes("counter_offered") ? (
              <form action={submitBookingCounterOfferAction} className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 space-y-4">
                <input type="hidden" name="bookingId" value={payload.booking.id} />
                <p className="text-xs uppercase tracking-[0.3em] text-violet-200/80">Counter offer</p>
                <h2 className="text-2xl font-semibold text-white">Propose new terms</h2>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Amount cents</span>
                  <input name="counterOfferAmountCents" type="number" defaultValue={payload.booking.totalCents} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Deposit cents</span>
                  <input name="counterOfferDepositCents" type="number" defaultValue={payload.booking.counterOfferDepositCents ?? payload.booking.depositRequiredCents} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Expiration hours</span>
                  <input name="counterOfferExpirationHours" type="number" min={1} step={1} defaultValue={24} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Note</span>
                  <textarea name="note" rows={3} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none" />
                </label>
                <button type="submit" className="rounded-full border border-violet-300/35 bg-violet-500/10 px-5 py-3 text-sm font-medium text-violet-100 transition hover:border-violet-300/50">
                  Send counter offer
                </button>
              </form>
            ) : null}

            <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Payments</p>
              <div className="mt-4 space-y-3">
                {payload.payments.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-400">No payment records yet.</p>
                ) : (
                  payload.payments.map((payment) => (
                    <div key={payment.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-300">
                      <p className="font-medium text-white">{formatCurrency(payment.amountCents)}</p>
                      <p className="mt-1 text-zinc-400">{payment.provider} • {payment.status}</p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Participants</p>
            <div className="mt-4 space-y-3">
              {payload.participants.map((participant) => (
                <div key={participant.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">{participant.displayName}</p>
                  <p className="mt-1 text-zinc-400">{participant.participantRole} • {participant.responseStatus}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Contracts</p>
            <div className="mt-4 space-y-3">
              {payload.contracts.map((contract) => (
                <div key={contract.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">{contract.title}</p>
                  <p className="mt-1 text-zinc-400">Version {contract.versionNumber} • {contract.status}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Notifications</p>
            <div className="mt-4 space-y-3">
              {payload.notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">{notification.notificationType}</p>
                  <p className="mt-1 text-zinc-400">{notification.status} • {notification.scheduledAt.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/bookings" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
            Back to bookings
          </Link>
        </div>
      </div>
    </main>
  );
}
