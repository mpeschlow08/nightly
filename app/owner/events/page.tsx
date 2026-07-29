import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createOwnerEventAction,
  deleteOwnerEventAction,
  updateOwnerEventAction,
} from "../actions";
import { getOwnerEvents, getOwnerVenue, type OwnerEventRecord } from "../lib/data";
import EmptyStateCard from "@/components/EmptyStateCard";

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

function splitEventGroups(events: OwnerEventRecord[]) {
  const now = Date.now();

  return {
    upcoming: events.filter((event) => event.startsAt.getTime() >= now),
    past: events.filter((event) => event.startsAt.getTime() < now),
  };
}

type OwnerEventsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function EventEditorCard({ event }: { event: OwnerEventRecord }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <form action={updateOwnerEventAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="eventId" value={event.id} />

        <div className="sm:col-span-2">
          <label htmlFor={`owner-event-title-${event.id}`} className="text-sm font-medium text-zinc-200">
            Title
          </label>
          <input
            id={`owner-event-title-${event.id}`}
            name="title"
            defaultValue={event.title}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`owner-event-description-${event.id}`} className="text-sm font-medium text-zinc-200">
            Description
          </label>
          <textarea
            id={`owner-event-description-${event.id}`}
            name="description"
            rows={3}
            defaultValue={event.description ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-starts-${event.id}`} className="text-sm font-medium text-zinc-200">
            Start date/time
          </label>
          <input
            id={`owner-event-starts-${event.id}`}
            type="datetime-local"
            name="startsAt"
            defaultValue={toDateTimeLocalValue(event.startsAt)}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-ends-${event.id}`} className="text-sm font-medium text-zinc-200">
            End date/time
          </label>
          <input
            id={`owner-event-ends-${event.id}`}
            type="datetime-local"
            name="endsAt"
            defaultValue={toDateTimeLocalValue(event.endsAt)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-cover-image-${event.id}`} className="text-sm font-medium text-zinc-200">
            Cover image URL
          </label>
          <input
            id={`owner-event-cover-image-${event.id}`}
            name="coverImageUrl"
            defaultValue={event.coverImageUrl ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-ticket-url-${event.id}`} className="text-sm font-medium text-zinc-200">
            Ticket URL
          </label>
          <input
            id={`owner-event-ticket-url-${event.id}`}
            name="ticketUrl"
            defaultValue={event.ticketUrl ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-price-${event.id}`} className="text-sm font-medium text-zinc-200">
            Price (USD)
          </label>
          <input
            id={`owner-event-price-${event.id}`}
            name="priceDollars"
            type="number"
            min="0"
            step="0.01"
            defaultValue={toDollars(event.coverCents)}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-age-${event.id}`} className="text-sm font-medium text-zinc-200">
            Age requirement
          </label>
          <input
            id={`owner-event-age-${event.id}`}
            name="ageRequirement"
            type="number"
            min="0"
            max="25"
            defaultValue={event.ageRequirement ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-genre-${event.id}`} className="text-sm font-medium text-zinc-200">
            Genre
          </label>
          <input
            id={`owner-event-genre-${event.id}`}
            name="genre"
            defaultValue={event.genre ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label htmlFor={`owner-event-dress-${event.id}`} className="text-sm font-medium text-zinc-200">
            Dress code
          </label>
          <input
            id={`owner-event-dress-${event.id}`}
            name="dressCode"
            defaultValue={event.dressCode ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input type="checkbox" name="isPublished" defaultChecked={event.isPublished} className="h-4 w-4 accent-cyan-500" />
            Published
          </label>
          <button type="submit" className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            Save changes
          </button>
        </div>
      </form>

      <form action={deleteOwnerEventAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <input type="hidden" name="eventId" value={event.id} />
        <label className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <input type="checkbox" name="confirmDelete" value="yes" required className="h-4 w-4 accent-rose-500" />
          Confirm deletion
        </label>
        <button type="submit" className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
          Delete event
        </button>
      </form>
    </article>
  );
}

export default async function OwnerEventsPage({ searchParams }: OwnerEventsPageProps) {
  const [{ venueId, venue }, ownerEvents, params] = await Promise.all([
    getOwnerVenue(),
    getOwnerEvents(),
    searchParams,
  ]);

  if (!venue) {
    notFound();
  }

  const { upcoming, past } = splitEventGroups(ownerEvents.events);

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Event Management</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{venue.name} Events</h2>

      {params.success ? (
        <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {params.success}
        </div>
      ) : null}
      {params.error ? (
        <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {params.error}
        </div>
      ) : null}

      {ownerEvents.unavailable ? (
        <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Events table is unavailable in this environment. Event forms are ready, but persistence requires the events migration.
        </div>
      ) : null}

      <form action={createOwnerEventAction} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <input type="hidden" name="venueId" value={venueId} />
        <h3 className="text-sm font-semibold text-white">Create event</h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="owner-event-create-title" className="text-sm font-medium text-zinc-200">
              Title
            </label>
            <input
              id="owner-event-create-title"
              name="title"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="owner-event-create-description" className="text-sm font-medium text-zinc-200">
              Description
            </label>
            <textarea
              id="owner-event-create-description"
              name="description"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-start" className="text-sm font-medium text-zinc-200">
              Start date/time
            </label>
            <input
              id="owner-event-create-start"
              type="datetime-local"
              name="startsAt"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-end" className="text-sm font-medium text-zinc-200">
              End date/time
            </label>
            <input
              id="owner-event-create-end"
              type="datetime-local"
              name="endsAt"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-cover-image" className="text-sm font-medium text-zinc-200">
              Cover image URL
            </label>
            <input
              id="owner-event-create-cover-image"
              name="coverImageUrl"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-ticket" className="text-sm font-medium text-zinc-200">
              Ticket URL
            </label>
            <input
              id="owner-event-create-ticket"
              name="ticketUrl"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-price" className="text-sm font-medium text-zinc-200">
              Price (USD)
            </label>
            <input
              id="owner-event-create-price"
              name="priceDollars"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0.00"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-age" className="text-sm font-medium text-zinc-200">
              Age requirement
            </label>
            <input
              id="owner-event-create-age"
              name="ageRequirement"
              type="number"
              min="0"
              max="25"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-genre" className="text-sm font-medium text-zinc-200">
              Genre
            </label>
            <input
              id="owner-event-create-genre"
              name="genre"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-dress" className="text-sm font-medium text-zinc-200">
              Dress code
            </label>
            <input
              id="owner-event-create-dress"
              name="dressCode"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-zinc-100">
              <input type="checkbox" name="isPublished" className="h-4 w-4 accent-cyan-500" />
              Published
            </label>
          </div>
        </div>

        <button type="submit" className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
          Create event
        </button>
      </form>

      {ownerEvents.events.length === 0 ? (
        <EmptyStateCard
          className="mt-6"
          icon="events"
          eyebrow="No Events"
          title="No events created yet"
          description="Publish your first event to boost visibility and help guests discover your venue faster."
          actions={
            <>
              <a
                href="#owner-event-create-title"
                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Create First Event
              </a>
              <Link
                href="/owner/venue"
                className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm text-zinc-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
              >
                Update Venue Details
              </Link>
            </>
          }
        />
      ) : (
        <>
          <div className="mt-6">
            <h3 className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">Upcoming events</h3>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">No upcoming events.</p>
            ) : (
              <div className="mt-3 grid gap-4">{upcoming.map((event) => <EventEditorCard key={event.id} event={event} />)}</div>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-sm uppercase tracking-[0.24em] text-zinc-300">Past events</h3>
            {past.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No past events.</p>
            ) : (
              <div className="mt-3 grid gap-4">{past.map((event) => <EventEditorCard key={event.id} event={event} />)}</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
