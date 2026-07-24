import { notFound } from "next/navigation";

import {
  createOwnerEventAction,
  deleteOwnerEventAction,
  updateOwnerEventAction,
} from "../actions";
import { getOwnerEvents, getOwnerVenue } from "../lib/data";

function toDateTimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 16);
}

function toDateInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 10);
}

function toTimeInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);

  return local.toISOString().slice(11, 16);
}

function toDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

type OwnerEventsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function OwnerEventsPage({ searchParams }: OwnerEventsPageProps) {
  const [{ venueId, venue }, ownerEvents, params] = await Promise.all([
    getOwnerVenue(),
    getOwnerEvents(),
    searchParams,
  ]);

  if (!venue) {
    notFound();
  }

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

          <div>
            <label htmlFor="owner-event-create-date" className="text-sm font-medium text-zinc-200">
              Date
            </label>
            <input
              id="owner-event-create-date"
              type="date"
              name="date"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-start" className="text-sm font-medium text-zinc-200">
              Start Time
            </label>
            <input
              id="owner-event-create-start"
              type="time"
              name="startTime"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-end" className="text-sm font-medium text-zinc-200">
              End Time
            </label>
            <input
              id="owner-event-create-end"
              type="time"
              name="endTime"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-event-create-cover" className="text-sm font-medium text-zinc-200">
              Cover price (USD)
            </label>
            <input
              id="owner-event-create-cover"
              name="coverDollars"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0.00"
              required
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
              Dress Code
            </label>
            <input
              id="owner-event-create-dress"
              name="dressCode"
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

          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-zinc-100">
              <input type="checkbox" name="isFeatured" className="h-4 w-4 accent-cyan-500" />
              Featured
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-zinc-100">
              <input type="checkbox" name="is21Plus" className="h-4 w-4 accent-cyan-500" />
              21+
            </label>
          </div>
        </div>

        <button type="submit" className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
          Create event
        </button>
      </form>

      {ownerEvents.events.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          No events yet for this venue.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {ownerEvents.events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
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

                <div>
                  <label htmlFor={`owner-event-date-${event.id}`} className="text-sm font-medium text-zinc-200">
                    Date
                  </label>
                  <input
                    id={`owner-event-date-${event.id}`}
                    type="date"
                    name="date"
                    defaultValue={toDateInputValue(event.eventDate)}
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={`owner-event-start-${event.id}`} className="text-sm font-medium text-zinc-200">
                    Start Time
                  </label>
                  <input
                    id={`owner-event-start-${event.id}`}
                    type="time"
                    name="startTime"
                    defaultValue={event.startTime || toTimeInputValue(event.startsAt)}
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={`owner-event-end-${event.id}`} className="text-sm font-medium text-zinc-200">
                    End Time
                  </label>
                  <input
                    id={`owner-event-end-${event.id}`}
                    type="time"
                    name="endTime"
                    defaultValue={event.endTime || (event.endsAt ? toTimeInputValue(event.endsAt) : "")}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label htmlFor={`owner-event-cover-${event.id}`} className="text-sm font-medium text-zinc-200">
                    Cover price (USD)
                  </label>
                  <input
                    id={`owner-event-cover-${event.id}`}
                    name="coverDollars"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={toDollars(event.coverCents)}
                    required
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
                    Dress Code
                  </label>
                  <input
                    id={`owner-event-dress-${event.id}`}
                    name="dressCode"
                    defaultValue={event.dressCode ?? ""}
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

                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
                    <input type="checkbox" name="isFeatured" defaultChecked={event.isFeatured} className="h-4 w-4 accent-cyan-500" />
                    Featured
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
                    <input type="checkbox" name="is21Plus" defaultChecked={event.is21Plus} className="h-4 w-4 accent-cyan-500" />
                    21+
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
          ))}
        </div>
      )}
    </section>
  );
}
