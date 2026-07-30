import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { venueProfileChangeRequests, venuePublishHistory } from "@/db/schema";

import { getOwnerVenue } from "../lib/data";
import { publishOwnerVenueAction, unpublishOwnerVenueAction } from "../workflow-actions";

type OwnerPublishingPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function OwnerPublishingPage({ searchParams }: OwnerPublishingPageProps) {
  const [{ venueId, venue }, params] = await Promise.all([getOwnerVenue(), searchParams]);

  const [pendingProfileRequest, publishHistory] = await Promise.all([
    db.query.venueProfileChangeRequests.findFirst({
      where: and(eq(venueProfileChangeRequests.venueId, venueId), eq(venueProfileChangeRequests.status, "pending")),
      columns: { id: true },
    }),
    db
      .select()
      .from(venuePublishHistory)
      .where(eq(venuePublishHistory.venueId, venueId))
      .orderBy(desc(venuePublishHistory.createdAt))
      .limit(20),
  ]);

  const completionChecks = [
    { label: "Venue claim approved", done: venue.verificationStatus === "verified" },
    { label: "Description", done: Boolean(venue.description?.trim()) },
    { label: "Hero image", done: Boolean(venue.heroImageUrl?.trim()) },
    { label: "Genres", done: Boolean(venue.genres?.length) },
    { label: "Contact phone", done: Boolean(venue.phone?.trim()) },
    { label: "Address", done: Boolean(venue.address?.trim()) },
    { label: "No pending profile changes", done: !pendingProfileRequest },
  ];

  const canPublish = completionChecks.every((item) => item.done);

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Phase 7</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Publishing</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Publish your venue to update Home, Explore, Venue Detail, Search, and Nightly Live automatically.
      </p>

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-white">Publishing readiness</p>
          <ul className="mt-3 space-y-2 text-sm">
            {completionChecks.map((check) => (
              <li key={check.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
                <span className="text-zinc-200">{check.label}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                    check.done
                      ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                      : "border-amber-300/40 bg-amber-500/20 text-amber-100"
                  }`}
                >
                  {check.done ? "Ready" : "Needs work"}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-white">Current status</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.publicationStatus}</p>

          <form action={publishOwnerVenueAction} className="mt-4 space-y-2">
            <input
              name="publishNotes"
              placeholder="Optional publish note"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              disabled={!canPublish}
              className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish venue
            </button>
          </form>

          <form action={unpublishOwnerVenueAction} className="mt-2">
            <button
              type="submit"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-zinc-100"
            >
              Move back to draft
            </button>
          </form>
        </article>
      </div>

      <article className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-white">Publish history</p>
        {publishHistory.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No publishing actions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {publishHistory.map((item) => (
              <li key={item.id} className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2">
                <p className="text-zinc-100">{item.action}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {item.previousStatus ?? "-"} → {item.nextStatus ?? "-"} • {item.createdAt.toLocaleString()}
                </p>
                {item.notes ? <p className="mt-1 text-xs text-zinc-300">{item.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
