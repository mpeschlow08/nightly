import { notFound } from "next/navigation";

import { getOwnerVenue } from "../lib/data";
import { getCurrentOwnerVenue } from "../lib/ownership";
import { isFeatureEnabled } from "@/lib/platform/feature-access";
import { getCommercialSubscriptionStatus } from "@/lib/commercial-entitlements/service";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }) : null;
}

function CommercialStatus({ commercial }: { commercial: Awaited<ReturnType<typeof getCommercialSubscriptionStatus>> }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Commercial status</p>
      <p className="mt-2 text-lg font-medium capitalize text-white">{commercial.state.replaceAll("_", " ")}</p>
      <p className="mt-1 text-sm text-zinc-400">Nightly venue package</p>
      {!commercial.scopeAvailable && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-sm text-amber-100">Venue access is currently unavailable. This is separate from subscription status.</p>}
      {commercial.scopeAvailable && commercial.state === "suspended" && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-sm text-amber-100">Paid venue features are paused. Device diagnostics and Nightly management remain available.</p>}
      {commercial.trialEndsAt && <p className="mt-3 text-sm text-zinc-300">Trial ends {dateLabel(commercial.trialEndsAt)}.</p>}
      {commercial.graceUntil && <p className="mt-1 text-sm text-zinc-300">Grace period ends {dateLabel(commercial.graceUntil)}.</p>}
      {commercial.endsAt && <p className="mt-1 text-sm text-zinc-300">Access ends {dateLabel(commercial.endsAt)}.</p>}
      {commercial.state === "expired" && <p className="mt-3 text-sm text-zinc-400">Commercial access is not active. Contact Nightly support for account assistance.</p>}
    </article>
  );
}

export default async function OwnerSettingsPage() {
  const owner = await getCurrentOwnerVenue();
  const settingsEnabled = await isFeatureEnabled("feature.beta_only_features", {
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    userId: owner.clerkUserId,
    venueId: owner.venueId,
    role: owner.role,
    city: owner.venue.city ?? undefined,
  });

  const [{ venue, role }, commercial] = await Promise.all([getOwnerVenue(), getCommercialSubscriptionStatus("venue", owner.venueId)]);

  if (!venue) {
    notFound();
  }

  if (!settingsEnabled) {
    return (
      <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Owner Settings</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Coming in a later release</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Staff management and billing controls are intentionally deferred from Nightly Beta V1.
        </p>
        <div className="mt-6"><CommercialStatus commercial={commercial} /></div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Owner Settings</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Account and Venue Settings</h2>
      <p className="mt-2 text-sm text-zinc-300">Manage your membership context and prepare for upcoming management features.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Membership Role</p>
          <p className="mt-2 text-lg font-medium text-white">{role}</p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Assigned Venue</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.name}</p>
          <p className="mt-1 text-sm text-zinc-400">{venue.city ?? "City not set"}</p>
        </article>
      </div>

      <article className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Staff Management</p>
        <p className="mt-2 text-sm text-zinc-300">Safe placeholder: invite and manage staff roles for this venue will be available here.</p>
        <div className="mt-4 rounded-xl border border-dashed border-white/20 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
          Staff management is coming soon.
        </div>
      </article>

      <div className="mt-4"><CommercialStatus commercial={commercial} /></div>
    </section>
  );
}
