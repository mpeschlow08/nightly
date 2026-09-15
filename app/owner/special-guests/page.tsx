import Link from "next/link";

import {
  archiveSpecialGuestAction,
  cancelSpecialGuestAction,
  createSpecialGuestAction,
  duplicateSpecialGuestAction,
  getOwnerSpecialGuestsData,
  updateSpecialGuestAction,
} from "@/app/owner/special-guest-actions";
import { toSpecialGuestTypeLabel } from "@/lib/special-guests/service";

type OwnerSpecialGuestsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function toDateTimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function statusClass(status: string) {
  if (status === "active") {
    return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "cancelled" || status === "archived") {
    return "border-rose-300/30 bg-rose-500/15 text-rose-100";
  }

  if (status === "expired") {
    return "border-zinc-300/30 bg-zinc-500/15 text-zinc-100";
  }

  return "border-amber-300/30 bg-amber-500/15 text-amber-100";
}

export default async function OwnerSpecialGuestsPage({ searchParams }: OwnerSpecialGuestsPageProps) {
  const params = await searchParams;
  const { rows, venueEvents } = await getOwnerSpecialGuestsData();

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-white/10 bg-zinc-950/70 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Owner Portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Special Guests</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          Manage venue and event appearances with verification controls, cancellation history, and scheduled visibility.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/owner/events" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-100">
            Back to Events
          </Link>
          <Link href="/discover" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-100">
            View Discover
          </Link>
        </div>
      </header>

      {params.success ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {params.success}
        </div>
      ) : null}

      {params.error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {params.error}
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/70 p-5">
        <h2 className="text-lg font-semibold text-white">Create Special Guest</h2>
        <form action={createSpecialGuestAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-display-name" className="text-sm text-zinc-200">Guest display name</label>
            <input id="new-display-name" name="displayName" required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-stage-name" className="text-sm text-zinc-200">Stage name (optional)</label>
            <input id="new-stage-name" name="stageName" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-guest-type" className="text-sm text-zinc-200">Guest type</label>
            <select id="new-guest-type" name="guestType" defaultValue="artist" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
              <option value="artist">Artist</option>
              <option value="celebrity">Celebrity</option>
              <option value="athlete">Athlete</option>
              <option value="influencer">Influencer</option>
              <option value="host">Host</option>
              <option value="special_appearance">Special Appearance</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label htmlFor="new-custom-guest-type" className="text-sm text-zinc-200">Custom type label</label>
            <input id="new-custom-guest-type" name="customGuestType" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-photo-url" className="text-sm text-zinc-200">Photo URL</label>
            <input id="new-photo-url" name="photoUrl" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-logo-url" className="text-sm text-zinc-200">Logo URL</label>
            <input id="new-logo-url" name="logoUrl" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="new-description" className="text-sm text-zinc-200">Short description</label>
            <textarea id="new-description" name="shortDescription" rows={2} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-appearance-start" className="text-sm text-zinc-200">Appearance start</label>
            <input id="new-appearance-start" type="datetime-local" name="appearanceStartAt" required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-appearance-end" className="text-sm text-zinc-200">Appearance end</label>
            <input id="new-appearance-end" type="datetime-local" name="appearanceEndAt" required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-visibility-start" className="text-sm text-zinc-200">Visibility start</label>
            <input id="new-visibility-start" type="datetime-local" name="visibilityStartAt" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-visibility-end" className="text-sm text-zinc-200">Visibility end</label>
            <input id="new-visibility-end" type="datetime-local" name="visibilityEndAt" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
          </div>

          <div>
            <label htmlFor="new-event-id" className="text-sm text-zinc-200">Attach to event (optional)</label>
            <select id="new-event-id" name="eventId" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
              <option value="">Venue only</option>
              {venueEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {event.startsAt.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="new-verification" className="text-sm text-zinc-200">Verification status</label>
            <select id="new-verification" name="verificationStatus" defaultValue="pending_review" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
              <option value="unverified">Unverified</option>
              <option value="pending_review">Pending review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="new-status" className="text-sm text-zinc-200">Lifecycle status</label>
            <select id="new-status" name="status" defaultValue="scheduled" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-cyan-500" />
            Active
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">
              Create Special Guest
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 space-y-4">
        {rows.length === 0 ? (
          <article className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 text-sm text-zinc-300">
            No special guests yet. Create your first appearance above.
          </article>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">{row.stageName ?? row.displayName}</h3>
                  <p className="text-sm text-zinc-400">
                    {toSpecialGuestTypeLabel(row.guestType, row.customGuestType)} · {row.displayName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-100">
                    {row.verificationStatus}
                  </span>
                  {row.eventId ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-200">Event linked</span>
                  ) : (
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-200">Venue linked</span>
                  )}
                </div>
              </div>

              <p className="mt-2 text-sm text-zinc-300">{row.shortDescription ?? "No description provided."}</p>

              <form action={updateSpecialGuestAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="guestId" value={row.id} />

                <div>
                  <label htmlFor={`display-${row.id}`} className="text-sm text-zinc-200">Display name</label>
                  <input id={`display-${row.id}`} name="displayName" defaultValue={row.displayName} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`stage-${row.id}`} className="text-sm text-zinc-200">Stage name</label>
                  <input id={`stage-${row.id}`} name="stageName" defaultValue={row.stageName ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`type-${row.id}`} className="text-sm text-zinc-200">Guest type</label>
                  <select id={`type-${row.id}`} name="guestType" defaultValue={row.guestType} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
                    <option value="artist">Artist</option>
                    <option value="celebrity">Celebrity</option>
                    <option value="athlete">Athlete</option>
                    <option value="influencer">Influencer</option>
                    <option value="host">Host</option>
                    <option value="special_appearance">Special Appearance</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`custom-${row.id}`} className="text-sm text-zinc-200">Custom type label</label>
                  <input id={`custom-${row.id}`} name="customGuestType" defaultValue={row.customGuestType ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`photo-${row.id}`} className="text-sm text-zinc-200">Photo URL</label>
                  <input id={`photo-${row.id}`} name="photoUrl" defaultValue={row.photoUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`logo-${row.id}`} className="text-sm text-zinc-200">Logo URL</label>
                  <input id={`logo-${row.id}`} name="logoUrl" defaultValue={row.logoUrl ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`desc-${row.id}`} className="text-sm text-zinc-200">Short description</label>
                  <textarea id={`desc-${row.id}`} name="shortDescription" rows={2} defaultValue={row.shortDescription ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`start-${row.id}`} className="text-sm text-zinc-200">Appearance start</label>
                  <input id={`start-${row.id}`} type="datetime-local" name="appearanceStartAt" defaultValue={toDateTimeLocalValue(row.appearanceStartAt)} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`end-${row.id}`} className="text-sm text-zinc-200">Appearance end</label>
                  <input id={`end-${row.id}`} type="datetime-local" name="appearanceEndAt" defaultValue={toDateTimeLocalValue(row.appearanceEndAt)} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`vstart-${row.id}`} className="text-sm text-zinc-200">Visibility start</label>
                  <input id={`vstart-${row.id}`} type="datetime-local" name="visibilityStartAt" defaultValue={toDateTimeLocalValue(row.visibilityStartAt)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`vend-${row.id}`} className="text-sm text-zinc-200">Visibility end</label>
                  <input id={`vend-${row.id}`} type="datetime-local" name="visibilityEndAt" defaultValue={toDateTimeLocalValue(row.visibilityEndAt)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>

                <div>
                  <label htmlFor={`event-${row.id}`} className="text-sm text-zinc-200">Event association</label>
                  <select id={`event-${row.id}`} name="eventId" defaultValue={row.eventId ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
                    <option value="">Venue only</option>
                    {venueEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title} - {event.startsAt.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`verify-${row.id}`} className="text-sm text-zinc-200">Verification</label>
                  <select id={`verify-${row.id}`} name="verificationStatus" defaultValue={row.verificationStatus} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
                    <option value="unverified">Unverified</option>
                    <option value="pending_review">Pending review</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`status-${row.id}`} className="text-sm text-zinc-200">Status</label>
                  <select id={`status-${row.id}`} name="status" defaultValue={row.status} className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white">
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
                  <input type="checkbox" name="isActive" defaultChecked={row.isActive} className="h-4 w-4 accent-cyan-500" />
                  Active
                </label>

                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button type="submit" className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-cyan-100">Save</button>
                  <button formAction={duplicateSpecialGuestAction} type="submit" className="rounded-full border border-sky-300/40 bg-sky-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-sky-100">Duplicate</button>
                  <button formAction={cancelSpecialGuestAction} type="submit" className="rounded-full border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-rose-100">Cancel</button>
                  <button formAction={archiveSpecialGuestAction} type="submit" className="rounded-full border border-amber-300/40 bg-amber-500/20 px-4 py-2 text-xs uppercase tracking-[0.14em] text-amber-100">Archive</button>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`cancel-reason-${row.id}`} className="text-sm text-zinc-200">Cancel reason (used by cancel action)</label>
                  <input id={`cancel-reason-${row.id}`} name="cancelReason" className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" />
                </div>
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
