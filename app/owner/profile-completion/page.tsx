import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { venueProfileChangeRequests } from "@/db/schema";

import { getOwnerVenue } from "../lib/data";
import { submitOwnerProfileForReviewAction } from "../workflow-actions";

type OwnerProfileCompletionPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function parseStringList(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return "";
    }

    return parsed.filter((item): item is string => typeof item === "string").join(", ");
  } catch {
    return "";
  }
}

function parseSocial(value: string | null) {
  if (!value) {
    return { instagram: "", tiktok: "", x: "" };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      instagram: typeof parsed.instagram === "string" ? parsed.instagram : "",
      tiktok: typeof parsed.tiktok === "string" ? parsed.tiktok : "",
      x: typeof parsed.x === "string" ? parsed.x : "",
    };
  } catch {
    return { instagram: "", tiktok: "", x: "" };
  }
}

export default async function OwnerProfileCompletionPage({ searchParams }: OwnerProfileCompletionPageProps) {
  const [{ venueId, venue }, params] = await Promise.all([getOwnerVenue(), searchParams]);

  if (!venue) {
    notFound();
  }

  const [latestRequest] = await db
    .select({
      id: venueProfileChangeRequests.id,
      status: venueProfileChangeRequests.status,
      createdAt: venueProfileChangeRequests.createdAt,
      reviewedAt: venueProfileChangeRequests.reviewedAt,
      reviewNotes: venueProfileChangeRequests.reviewNotes,
    })
    .from(venueProfileChangeRequests)
    .where(eq(venueProfileChangeRequests.venueId, venueId))
    .orderBy(desc(venueProfileChangeRequests.createdAt))
    .limit(1);

  const social = parseSocial(venue.socialLinksJson);

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Phase 5</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Profile Completion</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Submit owner profile updates for moderation. Approved updates are applied before publishing.
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

      {latestRequest ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
          Latest submission status:
          <span className="ml-2 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs uppercase tracking-[0.16em]">
            {latestRequest.status}
          </span>
          <p className="mt-1 text-xs text-zinc-400">Submitted {latestRequest.createdAt.toLocaleString()}</p>
          {latestRequest.reviewedAt ? (
            <p className="mt-1 text-xs text-zinc-400">Reviewed {latestRequest.reviewedAt.toLocaleString()}</p>
          ) : null}
          {latestRequest.reviewNotes ? <p className="mt-2 text-xs text-zinc-300">Notes: {latestRequest.reviewNotes}</p> : null}
        </div>
      ) : null}

      <form action={submitOwnerProfileForReviewAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="profile-description" className="text-sm font-medium text-zinc-200">
            Description
          </label>
          <textarea
            id="profile-description"
            name="description"
            rows={4}
            defaultValue={venue.description ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="profile-genres" className="text-sm font-medium text-zinc-200">
            Music genres
          </label>
          <input
            id="profile-genres"
            name="genres"
            defaultValue={venue.genres?.join(", ") ?? ""}
            placeholder="House, Open Format, Afrobeats"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="profile-amenities" className="text-sm font-medium text-zinc-200">
            Amenities
          </label>
          <input
            id="profile-amenities"
            name="amenities"
            defaultValue={parseStringList(venue.amenitiesJson)}
            placeholder="Dance floor, Patio, Valet"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-dress-code" className="text-sm font-medium text-zinc-200">
            Dress code
          </label>
          <input
            id="profile-dress-code"
            name="dressCode"
            defaultValue={venue.dressCode ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-parking" className="text-sm font-medium text-zinc-200">
            Parking
          </label>
          <input
            id="profile-parking"
            name="parkingInformation"
            defaultValue={venue.parkingInformation ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="sm:col-span-2 flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input name="vipAvailable" type="checkbox" defaultChecked={Boolean(venue.vipAvailable)} className="h-4 w-4 accent-cyan-500" />
            VIP available
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-zinc-100">
            <input
              name="bottleServiceAvailable"
              type="checkbox"
              defaultChecked={Boolean(venue.bottleServiceAvailable)}
              className="h-4 w-4 accent-cyan-500"
            />
            Bottle service
          </label>
        </div>

        <div>
          <label htmlFor="profile-social-instagram" className="text-sm font-medium text-zinc-200">
            Instagram
          </label>
          <input
            id="profile-social-instagram"
            name="socialInstagram"
            defaultValue={social.instagram}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-social-tiktok" className="text-sm font-medium text-zinc-200">
            TikTok
          </label>
          <input
            id="profile-social-tiktok"
            name="socialTiktok"
            defaultValue={social.tiktok}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-social-x" className="text-sm font-medium text-zinc-200">
            X / Twitter
          </label>
          <input
            id="profile-social-x"
            name="socialX"
            defaultValue={social.x}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-contact-email" className="text-sm font-medium text-zinc-200">
            Contact email
          </label>
          <input
            id="profile-contact-email"
            name="contactEmail"
            type="email"
            defaultValue={venue.contactEmail ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-contact-phone" className="text-sm font-medium text-zinc-200">
            Contact phone
          </label>
          <input
            id="profile-contact-phone"
            name="contactPhone"
            defaultValue={venue.phone ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="profile-website" className="text-sm font-medium text-zinc-200">
            Website
          </label>
          <input
            id="profile-website"
            name="websiteUrl"
            defaultValue={venue.websiteUrl ?? ""}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-100"
          >
            Submit profile for review
          </button>
        </div>
      </form>
    </section>
  );
}
