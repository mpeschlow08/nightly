import Link from "next/link";

import { BOOKING_TYPES } from "@/lib/bookings/types";
import { bookingTypeLabels } from "@/lib/bookings/lifecycle";
import type { BookingRequestOptions } from "@/app/bookings/lib/data";

type BookingRequestFormProps = {
  options: BookingRequestOptions;
  action: (formData: FormData) => Promise<void>;
};

export default function BookingRequestForm({ options, action }: BookingRequestFormProps) {
  return (
    <form action={action} className="space-y-5 rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">New booking</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Request a booking</h3>
        <p className="mt-2 text-sm text-zinc-300">Send a structured booking request to a DJ, venue, or both.</p>
      </div>

      <input type="hidden" name="submissionMode" value="request" />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Booking type</span>
          <select name="bookingType" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40">
            {BOOKING_TYPES.map((type) => (
              <option key={type} value={type}>
                {bookingTypeLabels(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">City</span>
          <input name="city" placeholder="New York" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Venue</span>
          <select name="venueId" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40">
            <option value="">No venue selected</option>
            {options.venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.title}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">DJ</span>
          <select name="djProfileId" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40">
            <option value="">No DJ selected</option>
            {options.djs.map((dj) => (
              <option key={dj.id} value={dj.id}>
                {dj.title}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Date</span>
          <input name="requestedDate" type="date" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Time</span>
          <input name="requestedTime" type="time" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Timezone</span>
          <input name="timezone" defaultValue="America/New_York" className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Duration minutes</span>
          <input name="durationMinutes" type="number" min={15} step={15} defaultValue={120} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Guest count</span>
          <input name="guestCount" type="number" min={0} step={1} defaultValue={150} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Budget cents</span>
          <input name="budgetCents" type="number" min={0} step={100} defaultValue={50000} className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Notes</span>
          <textarea name="notes" rows={4} placeholder="Describe the vibe, scope, timing, and any must-haves." className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Inspiration</span>
          <textarea name="inspirationText" rows={3} placeholder="Artists, venues, playlists, or reference events." className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/40" />
        </label>

        <label className="space-y-2 text-sm text-zinc-200 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-400">Special requests</span>
          <textarea name="specialRequests" rows={3} placeholder="Access, technical, payment, or hospitality details." className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/40" />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300">
          Submit request
        </button>
        <button type="submit" name="submissionMode" value="draft" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
          Save draft
        </button>
        <Link href="/concierge" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
          Ask concierge first
        </Link>
      </div>
    </form>
  );
}
