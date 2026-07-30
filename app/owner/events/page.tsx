import Link from "next/link";

import EmptyStateCard from "@/components/EmptyStateCard";
import EventLineupOrderClient from "@/components/owner/EventLineupOrderClient";

import {
  addEventLineupSlotAction,
  archiveManagedOwnerEventAction,
  cancelManagedOwnerEventAction,
  createManagedOwnerEventAction,
  deleteManagedOwnerEventAction,
  duplicateManagedOwnerEventAction,
  flagEventContentAction,
  generateRecurringEventsAction,
  publishManagedOwnerEventAction,
  removeEventLineupSlotAction,
  reorderEventLineupAction,
  requestEventRevisionAction,
  runEventLifecycleAutoTransitionAction,
  seedEventAnalyticsAction,
  unpublishManagedOwnerEventAction,
  updateManagedOwnerEventAction,
} from "../event-management-actions";
import {
  getEventDashboardData,
  type DashboardEventStatus,
  type EventDashboardItem,
} from "../lib/event-dashboard-data";

type OwnerEventsPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    q?: string;
    status?: DashboardEventStatus | "all";
    sort?: "newest" | "oldest" | "start_desc" | "start_asc" | "title_asc";
    page?: string;
    pageSize?: string;
  }>;
};

function toDateTimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function firstListItem(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as string[];
    if (!Array.isArray(parsed)) {
      return "";
    }
    return parsed.join("\n");
  } catch {
    return "";
  }
}

function firstObject(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return "";
  }
}

function statusClass(status: string) {
  if (status === "published" || status === "live") {
    return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "cancelled" || status === "archived") {
    return "border-rose-300/30 bg-rose-500/15 text-rose-100";
  }

  if (status === "completed") {
    return "border-zinc-300/30 bg-zinc-500/15 text-zinc-100";
  }

  return "border-amber-300/30 bg-amber-500/15 text-amber-100";
}

function groupEvents(events: EventDashboardItem[]) {
  const now = Date.now();

  return {
    upcoming: events.filter((event) => event.startsAt.getTime() > now && ["scheduled", "published"].includes(event.lifecycleStatus)),
    drafts: events.filter((event) => event.lifecycleStatus === "draft"),
    published: events.filter((event) => event.lifecycleStatus === "published" || event.lifecycleStatus === "live"),
    archived: events.filter((event) => event.lifecycleStatus === "archived"),
    completed: events.filter((event) => event.lifecycleStatus === "completed"),
    cancelled: events.filter((event) => event.lifecycleStatus === "cancelled"),
  };
}

function EventCard({
  event,
  venueName,
  djOptions,
  lineup,
  analytics,
  trafficSources,
  trends,
  moderationSummary,
  queuedNotifications,
}: {
  event: EventDashboardItem;
  venueName: string;
  djOptions: Array<{ id: number; stageName: string; username: string }>;
  lineup: Array<{
    id: number;
    eventId: number;
    djProfileId: number | null;
    guestDjName: string | null;
    performanceStartsAt: Date | null;
    performanceEndsAt: Date | null;
    isFeaturedDj: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    djName: string | null;
  }>;
  analytics:
    | {
        eventId: number;
        views: number;
        favorites: number;
        shares: number;
        guestListRequests: number;
        reservationRequests: number;
        ticketClicks: number;
      }
    | undefined;
  trafficSources: Array<{
    eventId: number;
    trafficSource: string;
    views: number;
    favorites: number;
    shares: number;
    guestListRequests: number;
    reservationRequests: number;
    ticketClicks: number;
  }>;
  trends: Array<{
    eventId: number;
    metricDate: Date;
    views: number;
    ticketClicks: number;
    guestListRequests: number;
    reservationRequests: number;
  }>;
  moderationSummary: { openFlags: number; openRevisions: number } | undefined;
  queuedNotifications: number;
}) {
  const lineupItems = lineup.map((row) => ({
    id: row.id,
    label: `${row.djName ?? row.guestDjName ?? "Unassigned DJ"}${row.isFeaturedDj ? " • Featured" : ""}`,
  }));

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusClass(event.lifecycleStatus)}`}>
            {event.lifecycleStatus}
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-200">
            {event.eventType}
          </span>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
            Moderation {event.approvalStatus}
          </span>
        </div>
        <p className="text-xs text-zinc-400">Queue: {queuedNotifications} pending notifications</p>
      </div>

      <form action={updateManagedOwnerEventAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="eventId" value={event.id} />

        <div>
          <label htmlFor={`title-${event.id}`} className="text-sm font-medium text-zinc-200">Title</label>
          <input id={`title-${event.id}`} name="title" defaultValue={event.title} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`subtitle-${event.id}`} className="text-sm font-medium text-zinc-200">Subtitle</label>
          <input id={`subtitle-${event.id}`} name="subtitle" defaultValue={event.subtitle ?? ""} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`description-${event.id}`} className="text-sm font-medium text-zinc-200">Description</label>
          <textarea id={`description-${event.id}`} name="description" rows={3} defaultValue={event.description ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`hero-${event.id}`} className="text-sm font-medium text-zinc-200">Hero Artwork URL</label>
          <input id={`hero-${event.id}`} name="coverImageUrl" defaultValue={event.coverImageUrl ?? ""} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-200">Venue</label>
          <input value={venueName} disabled className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300" />
        </div>

        <div>
          <label htmlFor={`starts-${event.id}`} className="text-sm font-medium text-zinc-200">Start Date</label>
          <input id={`starts-${event.id}`} type="datetime-local" name="startsAt" defaultValue={toDateTimeLocalValue(event.startsAt)} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`ends-${event.id}`} className="text-sm font-medium text-zinc-200">End Date</label>
          <input id={`ends-${event.id}`} type="datetime-local" name="endsAt" defaultValue={toDateTimeLocalValue(event.endsAt)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`doors-${event.id}`} className="text-sm font-medium text-zinc-200">Doors Open</label>
          <input id={`doors-${event.id}`} type="datetime-local" name="doorsOpenAt" defaultValue={toDateTimeLocalValue(event.doorsOpenAt)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`capacity-${event.id}`} className="text-sm font-medium text-zinc-200">Capacity</label>
          <input id={`capacity-${event.id}`} type="number" min="1" name="capacity" defaultValue={event.capacity ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`genres-${event.id}`} className="text-sm font-medium text-zinc-200">Genres (comma or newline)</label>
          <textarea id={`genres-${event.id}`} name="genres" rows={2} defaultValue={firstListItem(event.genresJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`age-${event.id}`} className="text-sm font-medium text-zinc-200">Age Requirement</label>
          <input id={`age-${event.id}`} type="number" min="0" max="25" name="ageRequirement" defaultValue={event.ageRequirement ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`dress-${event.id}`} className="text-sm font-medium text-zinc-200">Dress Code</label>
          <input id={`dress-${event.id}`} name="dressCode" defaultValue={event.dressCode ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`cover-${event.id}`} className="text-sm font-medium text-zinc-200">Cover Charge (USD)</label>
          <input id={`cover-${event.id}`} name="coverCharge" type="number" min="0" step="0.01" defaultValue={toDollars(event.coverCents)} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`eventType-${event.id}`} className="text-sm font-medium text-zinc-200">Event Type</label>
          <select id={`eventType-${event.id}`} name="eventType" defaultValue={event.eventType} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="event">Event</option>
            <option value="special">Special</option>
            <option value="guest_list">Guest List</option>
            <option value="reservation">Reservation</option>
          </select>
        </div>

        <div>
          <label htmlFor={`status-${event.id}`} className="text-sm font-medium text-zinc-200">Status</label>
          <select id={`status-${event.id}`} name="lifecycleStatus" defaultValue={event.lifecycleStatus} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label htmlFor={`visibility-${event.id}`} className="text-sm font-medium text-zinc-200">Visibility</label>
          <select id={`visibility-${event.id}`} name="visibility" defaultValue={event.visibility} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div>
          <label htmlFor={`ticket-${event.id}`} className="text-sm font-medium text-zinc-200">Ticket Link</label>
          <input id={`ticket-${event.id}`} name="ticketUrl" defaultValue={event.ticketUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`guest-${event.id}`} className="text-sm font-medium text-zinc-200">Guest List Link</label>
          <input id={`guest-${event.id}`} name="guestListUrl" defaultValue={event.guestListUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`reservation-${event.id}`} className="text-sm font-medium text-zinc-200">Reservation Link</label>
          <input id={`reservation-${event.id}`} name="reservationUrl" defaultValue={event.reservationUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`rsvp-${event.id}`} className="text-sm font-medium text-zinc-200">RSVP Link</label>
          <input id={`rsvp-${event.id}`} name="rsvpUrl" defaultValue={event.rsvpUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`table-${event.id}`} className="text-sm font-medium text-zinc-200">Table Reservations</label>
          <input id={`table-${event.id}`} name="tableReservationUrl" defaultValue={event.tableReservationUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`vip-${event.id}`} className="text-sm font-medium text-zinc-200">VIP Reservations</label>
          <input id={`vip-${event.id}`} name="vipReservationUrl" defaultValue={event.vipReservationUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label htmlFor={`bottle-${event.id}`} className="text-sm font-medium text-zinc-200">Bottle Service</label>
          <input id={`bottle-${event.id}`} name="bottleServiceUrl" defaultValue={event.bottleServiceUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`gallery-${event.id}`} className="text-sm font-medium text-zinc-200">Gallery URLs</label>
            <textarea id={`gallery-${event.id}`} name="galleryImages" rows={3} defaultValue={firstListItem(event.galleryImagesJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`flyers-${event.id}`} className="text-sm font-medium text-zinc-200">Flyer URLs</label>
            <textarea id={`flyers-${event.id}`} name="flyerImages" rows={3} defaultValue={firstListItem(event.flyerImageUrlsJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`videos-${event.id}`} className="text-sm font-medium text-zinc-200">Promo Video URLs</label>
            <textarea id={`videos-${event.id}`} name="promoVideos" rows={3} defaultValue={firstListItem(event.promoVideoUrlsJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`imported-${event.id}`} className="text-sm font-medium text-zinc-200">Imported Venue Imagery URLs</label>
            <textarea id={`imported-${event.id}`} name="importedVenueImages" rows={3} defaultValue={firstListItem(event.importedVenueImageUrlsJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`owner-uploaded-${event.id}`} className="text-sm font-medium text-zinc-200">Owner Upload URLs</label>
            <textarea id={`owner-uploaded-${event.id}`} name="ownerUploadedImages" rows={2} defaultValue={firstListItem(event.ownerUploadedImageUrlsJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`recurring-type-${event.id}`} className="text-sm font-medium text-zinc-200">Recurring Type</label>
            <select id={`recurring-type-${event.id}`} name="recurrenceType" defaultValue={event.recurrenceType ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
              <option value="">None</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label htmlFor={`recurring-interval-${event.id}`} className="text-sm font-medium text-zinc-200">Recurrence Interval</label>
            <input id={`recurring-interval-${event.id}`} type="number" min="1" max="365" name="recurrenceInterval" defaultValue={event.recurrenceInterval ?? 1} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`recurring-weekdays-${event.id}`} className="text-sm font-medium text-zinc-200">Weekdays</label>
            <input id={`recurring-weekdays-${event.id}`} name="recurrenceWeekdays" defaultValue={firstListItem(event.recurrenceWeekdaysJson)} placeholder="Mon, Fri" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`recurring-day-${event.id}`} className="text-sm font-medium text-zinc-200">Day of Month</label>
            <input id={`recurring-day-${event.id}`} type="number" min="1" max="31" name="recurrenceDayOfMonth" defaultValue={event.recurrenceDayOfMonth ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`recurrence-rule-${event.id}`} className="text-sm font-medium text-zinc-200">Custom Recurrence Rule</label>
            <input id={`recurrence-rule-${event.id}`} name="recurrenceRule" defaultValue={event.recurrenceRule ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`recurrence-ends-${event.id}`} className="text-sm font-medium text-zinc-200">Recurrence Ends</label>
            <input id={`recurrence-ends-${event.id}`} type="datetime-local" name="recurrenceEndsAt" defaultValue={toDateTimeLocalValue(event.recurrenceEndsAt)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`exceptions-${event.id}`} className="text-sm font-medium text-zinc-200">Exception Dates</label>
            <textarea id={`exceptions-${event.id}`} rows={2} name="recurrenceExceptionDates" defaultValue={firstListItem(event.recurrenceExceptionDatesJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label htmlFor={`holiday-${event.id}`} className="text-sm font-medium text-zinc-200">Holiday Overrides (JSON)</label>
            <textarea id={`holiday-${event.id}`} rows={2} name="recurrenceHolidayOverrides" defaultValue={firstObject(event.recurrenceHolidayOverridesJson)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input type="checkbox" name="isFeatured" defaultChecked={event.isFeatured} className="h-4 w-4 accent-cyan-500" />
            Featured
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input type="checkbox" name="isRecurring" defaultChecked={event.isRecurring} className="h-4 w-4 accent-cyan-500" />
            Recurring Event
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input type="checkbox" name="isPublished" defaultChecked={event.isPublished} className="h-4 w-4 accent-cyan-500" />
            Published
          </label>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`special-${event.id}`} className="text-sm font-medium text-zinc-200">Special Details</label>
          <textarea id={`special-${event.id}`} name="specialDetails" rows={2} defaultValue={event.specialDetails ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">Save</button>
          <button formAction={publishManagedOwnerEventAction} type="submit" className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-emerald-100">Publish</button>
          <button formAction={unpublishManagedOwnerEventAction} type="submit" className="rounded-full border border-zinc-300/40 bg-zinc-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-zinc-100">Unpublish</button>
          <button formAction={archiveManagedOwnerEventAction} type="submit" className="rounded-full border border-amber-300/40 bg-amber-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-amber-100">Archive</button>
          <button formAction={cancelManagedOwnerEventAction} type="submit" className="rounded-full border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-rose-100">Cancel</button>
          <button formAction={generateRecurringEventsAction} type="submit" className="rounded-full border border-sky-300/40 bg-sky-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-sky-100">Generate Recurring</button>
        </div>
      </form>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Duplication</p>
          <form action={duplicateManagedOwnerEventAction} className="mt-2 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="eventId" value={event.id} />
            <input type="datetime-local" name="duplicateStartsAt" required className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <input type="datetime-local" name="duplicateEndsAt" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <button type="submit" className="sm:col-span-2 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">Duplicate Event</button>
          </form>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Moderation</p>
          <p className="mt-1 text-xs text-zinc-300">Open Flags: {moderationSummary?.openFlags ?? 0} • Revision Requests: {moderationSummary?.openRevisions ?? 0}</p>
          <form action={flagEventContentAction} className="mt-2 grid gap-2">
            <input type="hidden" name="eventId" value={event.id} />
            <input name="reason" placeholder="Flag reason" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <textarea name="notes" placeholder="Flag notes" rows={2} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <button type="submit" className="rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-amber-100">Submit Flag</button>
          </form>
          <form action={requestEventRevisionAction} className="mt-2 grid gap-2">
            <input type="hidden" name="eventId" value={event.id} />
            <textarea name="notes" placeholder="Revision request notes" rows={2} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <button type="submit" className="rounded-full border border-zinc-300/40 bg-zinc-500/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-100">Request Revision</button>
          </form>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">DJ Lineup</p>
          <form action={addEventLineupSlotAction} className="mt-2 grid gap-2">
            <input type="hidden" name="eventId" value={event.id} />
            <select name="djProfileId" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
              <option value="">Select resident DJ profile</option>
              {djOptions.map((dj) => (
                <option key={dj.id} value={dj.id}>{dj.stageName} ({dj.username})</option>
              ))}
            </select>
            <input name="guestDjName" placeholder="Guest DJ name" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <input type="datetime-local" name="performanceStartsAt" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <input type="datetime-local" name="performanceEndsAt" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" name="isFeaturedDj" className="h-4 w-4 accent-cyan-500" />
              Featured DJ
            </label>
            <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">Add Lineup Slot</button>
          </form>

          <div className="mt-3">
            <EventLineupOrderClient eventId={event.id} items={lineupItems} action={reorderEventLineupAction} />
            <div className="mt-2 space-y-2">
              {lineup.map((slot) => (
                <form key={slot.id} action={removeEventLineupSlotAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="lineupId" value={slot.id} />
                  <button type="submit" className="rounded-full border border-rose-300/40 bg-rose-500/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-rose-100">
                    Remove {slot.djName ?? slot.guestDjName ?? `Slot ${slot.id}`}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Analytics</p>
            <form action={seedEventAnalyticsAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-cyan-100">
                Prepare Dataset
              </button>
            </form>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-200 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">Views: {analytics?.views ?? 0}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">Favorites: {analytics?.favorites ?? 0}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">Shares: {analytics?.shares ?? 0}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">Guest List: {analytics?.guestListRequests ?? 0}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">Reservations: {analytics?.reservationRequests ?? 0}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">Ticket Clicks: {analytics?.ticketClicks ?? 0}</div>
          </div>

          <div className="mt-3">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Traffic Sources</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-300">
              {trafficSources.length === 0 ? <li>No source data yet.</li> : null}
              {trafficSources.slice(0, 5).map((row) => (
                <li key={`${row.eventId}-${row.trafficSource}`} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  {row.trafficSource}: {row.views} views, {row.ticketClicks} ticket clicks
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Daily Trends</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-300">
              {trends.length === 0 ? <li>No trend data yet.</li> : null}
              {trends.slice(0, 7).map((row) => (
                <li key={`${row.eventId}-${row.metricDate.toISOString()}`} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  {row.metricDate.toLocaleDateString()}: {row.views} views, {row.ticketClicks} ticket clicks
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <form action={deleteManagedOwnerEventAction} className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        <input type="hidden" name="eventId" value={event.id} />
        <label className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <input type="checkbox" name="confirmDelete" value="yes" required className="h-4 w-4 accent-rose-500" />
          Confirm deletion
        </label>
        <button type="submit" className="rounded-full border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-rose-100">
          Delete Event
        </button>
      </form>
    </article>
  );
}

export default async function OwnerEventsPage({ searchParams }: OwnerEventsPageProps) {
  const params = await searchParams;

  const dashboard = await getEventDashboardData({
    q: params.q,
    status: params.status,
    sort: params.sort,
    page: params.page ? Number.parseInt(params.page, 10) : 1,
    pageSize: params.pageSize ? Number.parseInt(params.pageSize, 10) : 20,
  });

  const groups = groupEvents(dashboard.events);

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Event Management System</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{dashboard.venueName} Events Dashboard</h2>

      {params.success ? <div className="mt-5 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">{params.success}</div> : null}
      {params.error ? <div className="mt-5 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{params.error}</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">Upcoming: <span className="text-white">{groups.upcoming.length}</span></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">Drafts: <span className="text-white">{dashboard.counts.draft}</span></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">Published: <span className="text-white">{dashboard.counts.published + dashboard.counts.live}</span></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">Archived: <span className="text-white">{dashboard.counts.archived}</span></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">Completed: <span className="text-white">{dashboard.counts.completed}</span></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">Cancelled: <span className="text-white">{dashboard.counts.cancelled}</span></div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 flex-wrap gap-2" method="get">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search title, subtitle, description, genre" className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <select name="status" defaultValue={params.status ?? "all"} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="archived">Archived</option>
          </select>
          <select name="sort" defaultValue={params.sort ?? "newest"} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="start_desc">Start Date Desc</option>
            <option value="start_asc">Start Date Asc</option>
            <option value="title_asc">Title A-Z</option>
          </select>
          <select name="pageSize" defaultValue={String(dashboard.pageSize)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">Apply</button>
        </form>

        <form action={runEventLifecycleAutoTransitionAction}>
          <button type="submit" className="rounded-full border border-zinc-300/40 bg-zinc-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-zinc-100">Run Auto-Transitions</button>
        </form>
      </div>

      <form action={createManagedOwnerEventAction} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <input type="hidden" name="lifecycleStatus" value="draft" />
        <h3 className="text-sm font-semibold text-white">Create Event</h3>
        <p className="mt-1 text-xs text-zinc-400">Professional editor with publishing, ticketing, recurrence, and media controls.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="title" required placeholder="Title" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="subtitle" required placeholder="Subtitle" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="description" rows={3} placeholder="Description" className="sm:col-span-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="coverImageUrl" required placeholder="Hero artwork URL" className="sm:col-span-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="datetime-local" name="startsAt" required className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="datetime-local" name="endsAt" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="datetime-local" name="doorsOpenAt" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="genres" placeholder="Genres (comma/newline)" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="number" min="0" max="25" name="ageRequirement" placeholder="Age requirement" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="dressCode" placeholder="Dress code" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="number" min="1" name="capacity" placeholder="Capacity" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="number" min="0" step="0.01" name="coverCharge" defaultValue="0.00" required placeholder="Cover charge" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="ticketUrl" placeholder="Ticket link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="guestListUrl" placeholder="Guest list link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="reservationUrl" placeholder="Reservation link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="tableReservationUrl" placeholder="Table reservations link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="vipReservationUrl" placeholder="VIP reservations link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="bottleServiceUrl" placeholder="Bottle service link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="rsvpUrl" placeholder="RSVP link" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <select name="eventType" defaultValue="event" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="event">Event</option>
            <option value="special">Special</option>
            <option value="guest_list">Guest List</option>
            <option value="reservation">Reservation</option>
          </select>
          <select name="visibility" defaultValue="public" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>

          <textarea name="galleryImages" rows={2} placeholder="Gallery URLs" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="flyerImages" rows={2} placeholder="Flyer URLs" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="promoVideos" rows={2} placeholder="Promo video URLs" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="importedVenueImages" rows={2} placeholder="Imported venue imagery URLs" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="ownerUploadedImages" rows={2} placeholder="Owner upload URLs" className="sm:col-span-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />

          <select name="recurrenceType" defaultValue="" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
            <option value="">No recurrence</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          <input type="number" min="1" max="365" name="recurrenceInterval" defaultValue="1" placeholder="Recurrence interval" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="recurrenceWeekdays" placeholder="Weekdays (Mon, Fri)" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="number" min="1" max="31" name="recurrenceDayOfMonth" placeholder="Day of month" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input type="datetime-local" name="recurrenceEndsAt" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <input name="recurrenceRule" placeholder="Custom recurrence rule" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="recurrenceExceptionDates" rows={2} placeholder="Exception dates" className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          <textarea name="recurrenceHolidayOverrides" rows={2} placeholder='Holiday overrides JSON {"2026-12-31":"2027-01-01"}' className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />

          <textarea name="specialDetails" rows={2} placeholder="Special details" className="sm:col-span-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100"><input type="checkbox" name="isFeatured" className="h-4 w-4 accent-cyan-500" /> Featured</label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100"><input type="checkbox" name="isRecurring" className="h-4 w-4 accent-cyan-500" /> Recurring Event</label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100"><input type="checkbox" name="isPublished" className="h-4 w-4 accent-cyan-500" /> Publish Immediately</label>
          </div>
        </div>

        <button type="submit" className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">Create Event</button>
      </form>

      {dashboard.events.length === 0 ? (
        <EmptyStateCard
          className="mt-6"
          icon="events"
          eyebrow="No Events"
          title="No events created yet"
          description="Create your first event to appear across Home, Explore, Live, Search, and venue detail surfaces."
          actions={
            <>
              <a href="#" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">Create First Event</a>
              <Link href="/owner/venue" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm text-zinc-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/10">Update Venue Details</Link>
            </>
          }
        />
      ) : (
        <div className="mt-6 space-y-5">
          {dashboard.events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              venueName={dashboard.venueName}
              djOptions={dashboard.djDirectory}
              lineup={dashboard.lineupByEventId.get(event.id) ?? []}
              analytics={dashboard.analyticsByEventId.get(event.id)}
              trafficSources={dashboard.trafficSourceByEventId.get(event.id) ?? []}
              trends={dashboard.trendsByEventId.get(event.id) ?? []}
              moderationSummary={dashboard.moderationSummaryByEventId.get(event.id)}
              queuedNotifications={dashboard.pendingNotificationsByEventId.get(event.id) ?? 0}
            />
          ))}
        </div>
      )}

      {dashboard.totalCount > dashboard.pageSize ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
          <p>
            Showing {(dashboard.page - 1) * dashboard.pageSize + 1}-{Math.min(dashboard.page * dashboard.pageSize, dashboard.totalCount)} of {dashboard.totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`?${new URLSearchParams({
                q: params.q ?? "",
                status: params.status ?? "all",
                sort: params.sort ?? "newest",
                pageSize: String(dashboard.pageSize),
                page: String(Math.max(1, dashboard.page - 1)),
              }).toString()}`}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-zinc-200"
            >
              Previous
            </Link>
            <Link
              href={`?${new URLSearchParams({
                q: params.q ?? "",
                status: params.status ?? "all",
                sort: params.sort ?? "newest",
                pageSize: String(dashboard.pageSize),
                page: String(dashboard.page + 1),
              }).toString()}`}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-zinc-200"
            >
              Next
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
