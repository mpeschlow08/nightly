import { notFound } from "next/navigation";

import { getOwnerVenue } from "../lib/data";
import { getCurrentOwnerVenue } from "../lib/ownership";
import { isFeatureEnabled } from "@/lib/platform/feature-access";

export default async function OwnerSettingsPage() {
  const owner = await getCurrentOwnerVenue();
  const settingsEnabled = await isFeatureEnabled("feature.beta_only_features", {
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    userId: owner.clerkUserId,
    venueId: owner.venueId,
    role: owner.role,
    city: owner.venue.city ?? undefined,
  });

  const { venue, role } = await getOwnerVenue();

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

      <article className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Billing and Subscription</p>
        <p className="mt-2 text-sm text-zinc-300">Plan controls, invoices, and subscription upgrades will appear in this section.</p>
        <div className="mt-4 rounded-xl border border-dashed border-white/20 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
          Coming soon.
        </div>
      </article>
    </section>
  );
}
