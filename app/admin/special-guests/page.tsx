import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { reviewSpecialGuestAction } from "@/app/admin/actions";
import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { events, specialGuestAnalyticsDaily, specialGuestHistory, specialGuests, venues } from "@/db/schema";
import { buildSpecialGuestModerationFilter } from "@/lib/special-guests/service";

type AdminSpecialGuestsPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    verificationStatus?: string;
    status?: string;
    eventId?: string;
    venueId?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
};

function statusClass(status: string) {
  if (status === "verified" || status === "active") {
    return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "rejected" || status === "cancelled" || status === "archived") {
    return "border-rose-300/30 bg-rose-500/15 text-rose-100";
  }

  return "border-amber-300/30 bg-amber-500/15 text-amber-100";
}

function toPrettyJson(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export default async function AdminSpecialGuestsPage({ searchParams }: AdminSpecialGuestsPageProps) {
  await requireAdminPermission("events:view");
  await requireAdminPermission("events:moderate");

  const params = await searchParams;
  const filters = buildSpecialGuestModerationFilter({
    verificationStatus: params.verificationStatus,
    status: params.status,
    eventId: params.eventId,
    venueId: params.venueId,
    q: params.q,
    from: params.from,
    to: params.to,
  });
  const queryLower = filters.query.toLowerCase();

  const [guestRows, historyRows, analyticsRows] = await Promise.all([
    db
      .select({
        id: specialGuests.id,
        venueId: specialGuests.venueId,
        eventId: specialGuests.eventId,
        displayName: specialGuests.displayName,
        stageName: specialGuests.stageName,
        guestType: specialGuests.guestType,
        customGuestType: specialGuests.customGuestType,
        shortDescription: specialGuests.shortDescription,
        appearanceStartAt: specialGuests.appearanceStartAt,
        appearanceEndAt: specialGuests.appearanceEndAt,
        visibilityStartAt: specialGuests.visibilityStartAt,
        visibilityEndAt: specialGuests.visibilityEndAt,
        verificationStatus: specialGuests.verificationStatus,
        status: specialGuests.status,
        cancelledAt: specialGuests.cancelledAt,
        expiredAt: specialGuests.expiredAt,
        archivedAt: specialGuests.archivedAt,
        reviewedByClerkUserId: specialGuests.reviewedByClerkUserId,
        reviewedAt: specialGuests.reviewedAt,
        reviewNotes: specialGuests.reviewNotes,
        venueName: venues.name,
        eventTitle: events.title,
      })
      .from(specialGuests)
      .innerJoin(venues, eq(specialGuests.venueId, venues.id))
      .leftJoin(events, eq(specialGuests.eventId, events.id))
      .orderBy(desc(specialGuests.updatedAt), desc(specialGuests.id))
      .limit(200),
    db
      .select()
      .from(specialGuestHistory)
      .orderBy(desc(specialGuestHistory.createdAt), desc(specialGuestHistory.id))
      .limit(300),
    db
      .select({
        specialGuestId: specialGuestAnalyticsDaily.specialGuestId,
        views: specialGuestAnalyticsDaily.views,
        clicks: specialGuestAnalyticsDaily.clicks,
        venueConversions: specialGuestAnalyticsDaily.venueConversions,
        reservationConversions: specialGuestAnalyticsDaily.reservationConversions,
        ticketConversions: specialGuestAnalyticsDaily.ticketConversions,
        revenueCents: specialGuestAnalyticsDaily.revenueCents,
        popularityScore: specialGuestAnalyticsDaily.popularityScore,
        metricDate: specialGuestAnalyticsDaily.metricDate,
      })
      .from(specialGuestAnalyticsDaily)
      .orderBy(desc(specialGuestAnalyticsDaily.metricDate), desc(specialGuestAnalyticsDaily.id))
      .limit(500),
  ]);

  const historyByGuestId = new Map<number, Array<typeof historyRows[number]>>();
  for (const row of historyRows) {
    const current = historyByGuestId.get(row.specialGuestId) ?? [];
    current.push(row);
    historyByGuestId.set(row.specialGuestId, current);
  }

  const analyticsByGuestId = new Map<number, {
    views: number;
    clicks: number;
    venueConversions: number;
    reservationConversions: number;
    ticketConversions: number;
    revenueCents: number;
    popularityScore: number;
  }>();

  for (const row of analyticsRows) {
    const current = analyticsByGuestId.get(row.specialGuestId) ?? {
      views: 0,
      clicks: 0,
      venueConversions: 0,
      reservationConversions: 0,
      ticketConversions: 0,
      revenueCents: 0,
      popularityScore: 0,
    };

    current.views += row.views;
    current.clicks += row.clicks;
    current.venueConversions += row.venueConversions;
    current.reservationConversions += row.reservationConversions;
    current.ticketConversions += row.ticketConversions;
    current.revenueCents += row.revenueCents;
    current.popularityScore = Math.max(current.popularityScore, row.popularityScore);

    analyticsByGuestId.set(row.specialGuestId, current);
  }

  const eventOptions = Array.from(
    new Map(
      guestRows
        .filter((row) => row.eventId)
        .map((row) => [row.eventId as number, { eventId: row.eventId as number, eventTitle: row.eventTitle ?? `Event #${row.eventId}` }])
    ).values()
  ).sort((left, right) => left.eventTitle.localeCompare(right.eventTitle));

  const venueOptions = Array.from(
    new Map(guestRows.map((row) => [row.venueId, { venueId: row.venueId, venueName: row.venueName }])).values()
  ).sort((left, right) => left.venueName.localeCompare(right.venueName));

  const fromDate = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00.000Z`) : null;
  const toDate = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999Z`) : null;

  const filteredGuests = guestRows.filter((guest) => {
    if (filters.verificationStatus !== "all" && guest.verificationStatus !== filters.verificationStatus) {
      return false;
    }

    if (filters.status !== "all" && guest.status !== filters.status) {
      return false;
    }

    if (filters.eventId && guest.eventId !== filters.eventId) {
      return false;
    }

    if (filters.venueId && guest.venueId !== filters.venueId) {
      return false;
    }

    if (fromDate && guest.appearanceStartAt < fromDate) {
      return false;
    }

    if (toDate && guest.appearanceStartAt > toDate) {
      return false;
    }

    if (!queryLower) {
      return true;
    }

    const haystack = [
      guest.displayName,
      guest.stageName,
      guest.shortDescription,
      guest.guestType,
      guest.customGuestType,
      guest.venueName,
      guest.eventTitle,
      String(guest.id),
      String(guest.eventId ?? ""),
      String(guest.venueId),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(queryLower);
  });

  const todayUtc = new Date();
  const todayIso = `${todayUtc.getUTCFullYear()}-${String(todayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(todayUtc.getUTCDate()).padStart(2, "0")}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <section className="rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Admin Moderation</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Special Guests Review</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Verify guest announcements, prevent misleading promotions, and maintain historical accountability.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link
            href="/admin/special-guests?verificationStatus=pending_review"
            className="rounded-full border border-amber-300/35 bg-amber-500/15 px-3 py-1.5 uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-500/25"
          >
            Pending Review
          </Link>
          <Link
            href="/admin/special-guests?verificationStatus=rejected"
            className="rounded-full border border-rose-300/35 bg-rose-500/15 px-3 py-1.5 uppercase tracking-[0.14em] text-rose-100 hover:bg-rose-500/25"
          >
            Rejected
          </Link>
          <Link
            href={`/admin/special-guests?status=active&from=${todayIso}&to=${todayIso}`}
            className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3 py-1.5 uppercase tracking-[0.14em] text-cyan-100 hover:bg-cyan-500/25"
          >
            Active Tonight
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

        <form className="mt-5 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <input
            name="q"
            defaultValue={filters.query}
            placeholder="Search guest, venue, event"
            className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          <select name="verificationStatus" defaultValue={filters.verificationStatus} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white">
            <option value="all">All verification</option>
            <option value="pending_review">Pending review</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
          <select name="status" defaultValue={filters.status} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white">
            <option value="all">All lifecycle statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>
          <select name="eventId" defaultValue={filters.eventId ? String(filters.eventId) : "all"} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white">
            <option value="all">All events</option>
            {eventOptions.map((eventOption) => (
              <option key={eventOption.eventId} value={eventOption.eventId}>
                {eventOption.eventTitle}
              </option>
            ))}
          </select>
          <select name="venueId" defaultValue={filters.venueId ? String(filters.venueId) : "all"} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white">
            <option value="all">All venues</option>
            {venueOptions.map((venueOption) => (
              <option key={venueOption.venueId} value={venueOption.venueId}>
                {venueOption.venueName}
              </option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={filters.fromDate} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
          <input type="date" name="to" defaultValue={filters.toDate} className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
          <div className="flex items-center gap-2">
            <button type="submit" className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">
              Apply Filters
            </button>
            <Link href="/admin/special-guests" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-200">
              Reset
            </Link>
          </div>
        </form>

        <p className="mt-3 text-xs text-zinc-400">
          Showing {filteredGuests.length} of {guestRows.length} guests.
        </p>

        <div className="mt-6 space-y-4">
          {filteredGuests.length === 0 ? (
            <article className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              No special guests match the current filters.
            </article>
          ) : null}

          {filteredGuests.map((guest) => {
            const analytics = analyticsByGuestId.get(guest.id) ?? {
              views: 0,
              clicks: 0,
              venueConversions: 0,
              reservationConversions: 0,
              ticketConversions: 0,
              revenueCents: 0,
              popularityScore: 0,
            };
            const history = historyByGuestId.get(guest.id) ?? [];

            return (
              <article key={guest.id} id={`guest-${guest.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{guest.stageName ?? guest.displayName}</h2>
                    <p className="text-sm text-zinc-300">
                      {guest.guestType}
                      {guest.customGuestType ? ` (${guest.customGuestType})` : ""}
                      {" · "}
                      {guest.venueName}
                      {guest.eventTitle ? ` · ${guest.eventTitle}` : ""}
                    </p>
                    {guest.eventId ? (
                      <p className="mt-1 text-xs text-cyan-300/90">
                        <Link href={`/admin/events/${guest.eventId}`} className="hover:text-cyan-200">Open event</Link>
                        {" · "}
                        <Link href={`/admin/special-guests?eventId=${guest.eventId}#guest-${guest.id}`} className="hover:text-cyan-200">
                          Filter this event
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClass(guest.verificationStatus)}`}>
                      {guest.verificationStatus}
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClass(guest.status)}`}>
                      {guest.status}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-sm text-zinc-300">{guest.shortDescription ?? "No description provided."}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Appearance: {guest.appearanceStartAt.toLocaleString()} - {guest.appearanceEndAt.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Reviewed: {guest.reviewedByClerkUserId ?? "not reviewed"}
                  {guest.reviewedAt ? ` · ${guest.reviewedAt.toLocaleString()}` : ""}
                </p>

                <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">Views: {analytics.views}</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">Clicks: {analytics.clicks}</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">Venue conv: {analytics.venueConversions}</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">Reservation conv: {analytics.reservationConversions}</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">Ticket conv: {analytics.ticketConversions}</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">Revenue: ${(analytics.revenueCents / 100).toFixed(2)}</div>
                </div>

                <form action={reviewSpecialGuestAction} className="mt-4 grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="specialGuestId" value={guest.id} />

                  <div>
                    <label htmlFor={`verification-${guest.id}`} className="text-xs uppercase tracking-[0.14em] text-zinc-400">Verification</label>
                    <select id={`verification-${guest.id}`} name="verificationStatus" defaultValue={guest.verificationStatus} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
                      <option value="unverified">Unverified</option>
                      <option value="pending_review">Pending review</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={`status-${guest.id}`} className="text-xs uppercase tracking-[0.14em] text-zinc-400">Lifecycle Status</label>
                    <select id={`status-${guest.id}`} name="status" defaultValue={guest.status} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
                      <option value="scheduled">Scheduled</option>
                      <option value="active">Active</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="expired">Expired</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`notes-${guest.id}`} className="text-xs uppercase tracking-[0.14em] text-zinc-400">Review Notes</label>
                    <textarea id={`notes-${guest.id}`} name="reviewNotes" rows={2} defaultValue={guest.reviewNotes ?? ""} className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`reason-${guest.id}`} className="text-xs uppercase tracking-[0.14em] text-zinc-400">Reason</label>
                    <input id={`reason-${guest.id}`} name="reason" required placeholder="Explain moderation decision" className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                  </div>

                  <div className="sm:col-span-2">
                    <button type="submit" className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs uppercase tracking-[0.16em] text-cyan-100">
                      Save Review Decision
                    </button>
                  </div>
                </form>

                <details className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                  <summary className="cursor-pointer text-sm text-zinc-200">History ({history.length})</summary>
                  <div className="mt-2 space-y-2">
                    {history.length === 0 ? <p className="text-xs text-zinc-400">No history entries.</p> : null}
                    {history.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                        <p className="text-xs text-zinc-200">{entry.action} · {entry.actorClerkUserId} · {entry.createdAt.toLocaleString()}</p>
                        <pre className="mt-1 overflow-x-auto text-[11px] text-zinc-400">{toPrettyJson(entry.payloadJson)}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
