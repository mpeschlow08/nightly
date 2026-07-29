import { notFound } from "next/navigation";

import { dayLabels, formatHourLabel } from "@/app/api/venues/lib/venues";

import { copyMondayHoursToWeekdaysAction, updateOwnerVenueHoursAction } from "../actions";
import { getOwnerVenue, getOwnerVenueBusinessHours } from "../lib/data";

type OwnerHoursPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function OwnerHoursPage({ searchParams }: OwnerHoursPageProps) {
  const [{ venueId, venue }, hourState, params] = await Promise.all([
    getOwnerVenue(),
    getOwnerVenueBusinessHours(),
    searchParams,
  ]);

  if (!venue) {
    notFound();
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Business Hours</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{venue.name} Hours</h2>
      <p className="mt-2 text-sm text-zinc-300">Set open and close windows for each day of the week.</p>

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

      {hourState.unavailable ? (
        <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Business hours table is unavailable in this environment. Saving will require the next migration.
        </div>
      ) : null}

      <form action={updateOwnerVenueHoursAction} className="mt-6 space-y-3">
        <input type="hidden" name="venueId" value={venueId} />

        {hourState.hours.map((hourRow) => (
          <article key={hourRow.dayOfWeek} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[170px_1fr_1fr_auto] md:items-center">
            <p className="text-sm font-medium text-white">{dayLabels[hourRow.dayOfWeek]}</p>

            <div>
              <label htmlFor={`open-${hourRow.dayOfWeek}`} className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Open
              </label>
              <input
                id={`open-${hourRow.dayOfWeek}`}
                name={`open-${hourRow.dayOfWeek}`}
                type="time"
                defaultValue={hourRow.openTime ?? ""}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label htmlFor={`close-${hourRow.dayOfWeek}`} className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Close
              </label>
              <input
                id={`close-${hourRow.dayOfWeek}`}
                name={`close-${hourRow.dayOfWeek}`}
                type="time"
                defaultValue={hourRow.closeTime ?? ""}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
              <input
                type="checkbox"
                name={`closed-${hourRow.dayOfWeek}`}
                defaultChecked={hourRow.isClosed}
                className="h-4 w-4 accent-cyan-500"
              />
              Closed
            </label>

            <div className="md:col-span-4 text-xs text-zinc-400">
              Public display: {hourRow.isClosed ? "Closed" : `${formatHourLabel(hourRow.openTime)} - ${formatHourLabel(hourRow.closeTime)}`}
            </div>
          </article>
        ))}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            Save business hours
          </button>
          <button
            type="submit"
            formAction={copyMondayHoursToWeekdaysAction}
            className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm text-zinc-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
          >
            Copy Monday to weekdays
          </button>
        </div>
      </form>
    </section>
  );
}
