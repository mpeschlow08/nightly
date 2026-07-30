import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { requireAdminUser } from "@/app/admin/lib/auth";
import { db } from "@/db";
import {
  auditLogs,
  eventModerationFlags,
  eventRevisionRequests,
  events,
  venueClaimRequests,
  venueProfileChangeRequests,
  venues,
} from "@/db/schema";

import {
  approveClaimRequestAction,
  approveOwnerEventAction,
  approveProfileChangeRequestAction,
  publishVenueFromAdminAction,
  rejectClaimRequestAction,
  rejectOwnerEventAction,
  rejectProfileChangeRequestAction,
  resolveEventFlagAction,
  resolveEventRevisionRequestAction,
} from "./actions";

type AdminReviewPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function statusBadge(status: string) {
  if (status === "approved" || status === "claimed") {
    return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "rejected") {
    return "border-rose-300/30 bg-rose-500/15 text-rose-100";
  }

  return "border-amber-300/30 bg-amber-500/15 text-amber-100";
}

function tryPrettyJson(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export default async function AdminReviewPage({ searchParams }: AdminReviewPageProps) {
  await requireAdminUser();

  const params = await searchParams;

  const [claimRequests, profileRequests, pendingEvents, eventFlags, revisionRequests, rejectedClaims, rejectedProfiles, publishCandidates, logs] = await Promise.all([
    db
      .select()
      .from(venueClaimRequests)
      .where(eq(venueClaimRequests.status, "pending"))
      .orderBy(desc(venueClaimRequests.createdAt))
      .limit(40),
    db
      .select({
        id: venueProfileChangeRequests.id,
        venueId: venueProfileChangeRequests.venueId,
        submittedByClerkUserId: venueProfileChangeRequests.submittedByClerkUserId,
        previousValuesJson: venueProfileChangeRequests.previousValuesJson,
        proposedValuesJson: venueProfileChangeRequests.proposedValuesJson,
        status: venueProfileChangeRequests.status,
        createdAt: venueProfileChangeRequests.createdAt,
      })
      .from(venueProfileChangeRequests)
      .where(eq(venueProfileChangeRequests.status, "pending"))
      .orderBy(desc(venueProfileChangeRequests.createdAt))
      .limit(40),
    db
      .select({
        id: events.id,
        venueId: events.venueId,
        title: events.title,
        startsAt: events.startsAt,
        approvalStatus: events.approvalStatus,
        publicationStatus: events.publicationStatus,
      })
      .from(events)
      .where(eq(events.approvalStatus, "pending"))
      .orderBy(desc(events.createdAt))
      .limit(60),
    db
      .select({
        id: eventModerationFlags.id,
        eventId: eventModerationFlags.eventId,
        reason: eventModerationFlags.reason,
        notes: eventModerationFlags.notes,
        status: eventModerationFlags.status,
        createdAt: eventModerationFlags.createdAt,
      })
      .from(eventModerationFlags)
      .where(eq(eventModerationFlags.status, "open"))
      .orderBy(desc(eventModerationFlags.createdAt))
      .limit(60),
    db
      .select({
        id: eventRevisionRequests.id,
        eventId: eventRevisionRequests.eventId,
        notes: eventRevisionRequests.notes,
        status: eventRevisionRequests.status,
        createdAt: eventRevisionRequests.createdAt,
      })
      .from(eventRevisionRequests)
      .where(eq(eventRevisionRequests.status, "open"))
      .orderBy(desc(eventRevisionRequests.createdAt))
      .limit(60),
    db
      .select({
        id: venueClaimRequests.id,
        venueName: venueClaimRequests.venueName,
        status: venueClaimRequests.status,
        createdAt: venueClaimRequests.createdAt,
      })
      .from(venueClaimRequests)
      .where(eq(venueClaimRequests.status, "rejected"))
      .orderBy(desc(venueClaimRequests.createdAt))
      .limit(20),
    db
      .select({
        id: venueProfileChangeRequests.id,
        venueId: venueProfileChangeRequests.venueId,
        status: venueProfileChangeRequests.status,
        createdAt: venueProfileChangeRequests.createdAt,
      })
      .from(venueProfileChangeRequests)
      .where(eq(venueProfileChangeRequests.status, "rejected"))
      .orderBy(desc(venueProfileChangeRequests.createdAt))
      .limit(20),
    db
      .select({ id: venues.id, name: venues.name, publicationStatus: venues.publicationStatus })
      .from(venues)
      .where(eq(venues.publicationStatus, "draft"))
      .orderBy(desc(venues.updatedAt))
      .limit(40),
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(40),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <section className="rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Admin Moderation</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Review Queue</h1>
          </div>
          <Link
            href="/admin/analytics"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-zinc-200"
          >
            Analytics
          </Link>
        </div>

        {params.success ? (
          <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
            {params.success}
          </div>
        ) : null}
        {params.error ? (
          <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            {params.error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">New Claims</h2>
            <div className="mt-3 space-y-3">
              {claimRequests.length === 0 ? <p className="text-sm text-zinc-400">No pending claims.</p> : null}
              {claimRequests.map((claim) => (
                <div key={claim.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  <p className="font-medium text-white">{claim.venueName}</p>
                  <p className="mt-1 text-sm text-zinc-300">{claim.venueAddress}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {claim.businessEmail} • {claim.businessPhone}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Submitted {claim.createdAt.toLocaleString()}</p>

                  <div className="mt-3 grid gap-2">
                    <form action={approveClaimRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="claimRequestId" value={claim.id} />
                      <input
                        name="adminNotes"
                        placeholder="Approval notes (optional)"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-100"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectClaimRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="claimRequestId" value={claim.id} />
                      <input
                        name="adminNotes"
                        placeholder="Rejection reason"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-rose-100"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Profile Changes</h2>
            <div className="mt-3 space-y-3">
              {profileRequests.length === 0 ? <p className="text-sm text-zinc-400">No pending profile submissions.</p> : null}
              {profileRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  <p className="font-medium text-white">Venue #{request.venueId}</p>
                  <p className="mt-1 text-xs text-zinc-400">Submitted by {request.submittedByClerkUserId}</p>
                  <details className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-zinc-300">
                    <summary className="cursor-pointer text-zinc-200">View requested changes</summary>
                    <pre className="mt-2 whitespace-pre-wrap">{tryPrettyJson(request.proposedValuesJson)}</pre>
                  </details>

                  <div className="mt-3 grid gap-2">
                    <form action={approveProfileChangeRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="profileRequestId" value={request.id} />
                      <input
                        name="reviewNotes"
                        placeholder="Approval notes"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-100"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectProfileChangeRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="profileRequestId" value={request.id} />
                      <input
                        name="reviewNotes"
                        placeholder="Rejection reason"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-rose-100"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Event Approvals</h2>
            <div className="mt-3 space-y-3">
              {pendingEvents.length === 0 ? <p className="text-sm text-zinc-400">No events pending moderation.</p> : null}
              {pendingEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">Venue #{event.venueId} • {event.startsAt.toLocaleString()}</p>
                  <div className="mt-3 grid gap-2">
                    <form action={approveOwnerEventAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="eventId" value={event.id} />
                      <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-zinc-100">
                        <input type="checkbox" name="publishNow" className="h-4 w-4 accent-emerald-500" />
                        Publish now
                      </label>
                      <button
                        type="submit"
                        className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-100"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectOwnerEventAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input
                        name="reviewNotes"
                        placeholder="Rejection reason"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-rose-100"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Publish Queue</h2>
            <div className="mt-3 space-y-3">
              {publishCandidates.length === 0 ? <p className="text-sm text-zinc-400">No draft venues waiting for publish.</p> : null}
              {publishCandidates.map((venue) => (
                <div key={venue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  <div>
                    <p className="font-medium text-white">{venue.name}</p>
                    <p className="text-xs text-zinc-400">Current status: {venue.publicationStatus}</p>
                  </div>
                  <form action={publishVenueFromAdminAction}>
                    <input type="hidden" name="venueId" value={venue.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-cyan-100"
                    >
                      Publish
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Event Content Flags</h2>
            <div className="mt-3 space-y-3">
              {eventFlags.length === 0 ? <p className="text-sm text-zinc-400">No open content flags.</p> : null}
              {eventFlags.map((flag) => (
                <div key={flag.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  <p className="font-medium text-white">Event #{flag.eventId}</p>
                  <p className="mt-1 text-xs text-zinc-300">Reason: {flag.reason}</p>
                  {flag.notes ? <p className="mt-1 text-xs text-zinc-400">{flag.notes}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500">Flagged {flag.createdAt.toLocaleString()}</p>
                  <form action={resolveEventFlagAction} className="mt-2">
                    <input type="hidden" name="flagId" value={flag.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-100"
                    >
                      Resolve Flag
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Event Revision Requests</h2>
            <div className="mt-3 space-y-3">
              {revisionRequests.length === 0 ? <p className="text-sm text-zinc-400">No open revision requests.</p> : null}
              {revisionRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
                  <p className="font-medium text-white">Event #{request.eventId}</p>
                  <p className="mt-1 text-xs text-zinc-300">{request.notes}</p>
                  <p className="mt-1 text-xs text-zinc-500">Requested {request.createdAt.toLocaleString()}</p>
                  <form action={resolveEventRevisionRequestAction} className="mt-2">
                    <input type="hidden" name="revisionRequestId" value={request.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-cyan-100"
                    >
                      Resolve Request
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Rejected Submissions</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rejectedClaims.map((item) => (
              <div key={`claim-${item.id}`} className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
                <p className="text-sm font-medium text-white">Claim: {item.venueName}</p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusBadge(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))}
            {rejectedProfiles.map((item) => (
              <div key={`profile-${item.id}`} className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
                <p className="text-sm font-medium text-white">Profile: Venue #{item.venueId}</p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusBadge(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))}
            {rejectedClaims.length === 0 && rejectedProfiles.length === 0 ? (
              <p className="text-sm text-zinc-400">No rejected submissions.</p>
            ) : null}
          </div>
        </article>

        <article className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Audit Log</h2>
          {logs.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No audit records yet.</p> : null}
          <ul className="mt-3 space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
                <p className="text-sm text-zinc-100">
                  {log.action} • {log.entityType} #{log.entityId}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {log.actorClerkUserId} • {log.createdAt.toLocaleString()}
                </p>
                {log.previousValuesJson ? (
                  <details className="mt-1 text-xs text-zinc-300">
                    <summary className="cursor-pointer text-zinc-400">Previous values</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{tryPrettyJson(log.previousValuesJson)}</pre>
                  </details>
                ) : null}
                {log.nextValuesJson ? (
                  <details className="mt-1 text-xs text-zinc-300">
                    <summary className="cursor-pointer text-zinc-400">Next values</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{tryPrettyJson(log.nextValuesJson)}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
