import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { requestVenueClaimAction } from "./actions";
import { getOwnerClaimRequests, searchClaimableVenues } from "@/app/owner/lib/claim-workflow";
import { getCurrentOwnerVenueOptional } from "@/app/owner/lib/ownership";

type ClaimPageProps = {
  searchParams: Promise<{
    q?: string;
    success?: string;
    error?: string;
  }>;
};

function statusBadge(status: string) {
  if (status === "claimed" || status === "approved") {
    return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "rejected") {
    return "border-rose-300/30 bg-rose-500/15 text-rose-100";
  }

  return "border-amber-300/30 bg-amber-500/15 text-amber-100";
}

export default async function OwnerClaimVenuePage({ searchParams }: ClaimPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const [params, membership, requests] = await Promise.all([
    searchParams,
    getCurrentOwnerVenueOptional(),
    getOwnerClaimRequests(userId),
  ]);

  if (membership) {
    redirect("/owner");
  }

  const query = params.q?.trim() ?? "";
  const results = query ? await searchClaimableVenues(query) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-6 text-zinc-100 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Owner Onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Claim Your Venue</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Search by venue name, Google Place ID, or address. Submit a claim request for admin review to unlock the full owner dashboard.
        </p>

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

        <form method="get" className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by business name, address, or place id"
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
          />
          <button
            type="submit"
            className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-100"
          >
            Search venues
          </button>
        </form>

        <div className="mt-6 space-y-4">
          {results.length === 0 && query ? (
            <p className="text-sm text-zinc-400">No matches found. Try a broader query.</p>
          ) : null}

          {results.map((result, index) => (
            <article key={`${result.source}-${result.venueId ?? result.googlePlaceId ?? index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-4 sm:grid-cols-[112px_1fr]">
                <div className="h-24 w-28 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
                  {result.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.photoUrl} alt={`${result.name} photo`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      No photo
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{result.name}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${statusBadge(result.status)}`}>
                      {result.status}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-300">
                      {result.source === "google" ? "Google" : "Imported"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-zinc-300">{result.address}</p>
                  <p className="mt-1 text-xs text-zinc-400">Category: {result.category ?? "Not specified"}</p>

                  {result.status === "unclaimed" ? (
                    <form action={requestVenueClaimAction} className="mt-4 grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="venueId" value={result.venueId ?? ""} />
                      <input type="hidden" name="googlePlaceId" value={result.googlePlaceId ?? ""} />
                      <input type="hidden" name="venueName" value={result.name} />
                      <input type="hidden" name="venueAddress" value={result.address} />
                      <input type="hidden" name="venueCategory" value={result.category ?? ""} />

                      <input
                        name="businessEmail"
                        type="email"
                        required
                        placeholder="Business email"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                      />
                      <input
                        name="businessPhone"
                        required
                        placeholder="Business phone"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                      />
                      <input
                        name="websiteUrl"
                        placeholder="Website (optional)"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                      />
                      <input
                        name="claimantRole"
                        defaultValue="Owner"
                        placeholder="Role"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                      />
                      <textarea
                        name="notes"
                        rows={2}
                        placeholder="Optional notes for verification"
                        className="sm:col-span-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-2 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-100"
                      >
                        Request claim
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-zinc-950/75 p-6 text-zinc-100 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Your Claim Requests</h2>
          <Link
            href="/home"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-zinc-200"
          >
            Back to home
          </Link>
        </div>

        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">You have not submitted any claim requests yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{request.venueName}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${statusBadge(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{request.venueAddress}</p>
                <p className="mt-2 text-xs text-zinc-400">
                  Submitted {request.createdAt.toLocaleString()}
                  {request.reviewedAt ? ` • Reviewed ${request.reviewedAt.toLocaleString()}` : ""}
                </p>
                {request.adminNotes ? <p className="mt-2 text-xs text-zinc-300">Admin notes: {request.adminNotes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
