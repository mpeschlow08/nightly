import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  getOwnerCameras,
  getOwnerEvents,
  getOwnerRecentActivity,
  getOwnerUpcomingEventCount,
  getOwnerVenue,
  getOwnerVenueImages,
} from "./lib/data";
import { getCurrentOwnerVenueOptional } from "./lib/ownership";
import { isFeatureEnabled } from "@/lib/platform/feature-access";

function toCompletionItems(venue: NonNullable<Awaited<ReturnType<typeof getOwnerVenue>>["venue"]>) {
  return [
    { label: "Venue name", done: Boolean(venue.name.trim()) },
    { label: "Description", done: Boolean(venue.description?.trim()) },
    { label: "Address", done: Boolean(venue.address?.trim()) },
    { label: "Phone", done: Boolean(venue.phone?.trim()) },
    { label: "Website", done: Boolean(venue.websiteUrl?.trim()) },
    { label: "Genres", done: Boolean(venue.genres?.length) },
    { label: "Business map coordinates", done: venue.latitude != null && venue.longitude != null },
  ];
}

export default async function OwnerDashboardPage() {
  const membership = await getCurrentOwnerVenueOptional();

  if (!membership) {
    redirect("/owner/claim");
  }

  const [owner, images, upcomingEventCount, ownerEvents, cameras, recentActivity, liveCamerasEnabled, betaOnlyFeaturesEnabled] = await Promise.all([
    getOwnerVenue(),
    getOwnerVenueImages(),
    getOwnerUpcomingEventCount(),
    getOwnerEvents(),
    getOwnerCameras(),
    getOwnerRecentActivity(),
    isFeatureEnabled("feature.live_cameras", {
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
      userId: membership.clerkUserId,
      venueId: membership.venueId,
      role: membership.role,
      city: membership.venue.city ?? undefined,
    }),
    isFeatureEnabled("feature.beta_only_features", {
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
      userId: membership.clerkUserId,
      venueId: membership.venueId,
      role: membership.role,
      city: membership.venue.city ?? undefined,
    }),
  ]);

  const { venue } = owner;

  if (!venue) {
    notFound();
  }

  const completionItems = toCompletionItems(venue);
  const completedCount = completionItems.filter((item) => item.done).length;
  const completionPercent = Math.round((completedCount / completionItems.length) * 100);
  const missingItems = completionItems.filter((item) => !item.done);

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Owner Dashboard</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{venue.name}</h2>
      <p className="mt-2 text-sm text-zinc-300">Venue overview for your assigned owner membership.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Profile Completion</p>
          <p className="mt-2 text-2xl font-semibold text-white">{completionPercent}%</p>
          <p className="mt-1 text-xs text-cyan-100/80">{completedCount} of {completionItems.length} key fields complete</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">City</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.city ?? "Not set"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Live Status</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.isLive ? "Live now" : "Not live"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Crowd Level</p>
          <p className="mt-2 text-lg font-medium text-white">{venue.crowdLevel ?? "Unknown"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Total Images</p>
          <p className="mt-2 text-lg font-medium text-white">{images.length}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Upcoming Events</p>
          <p className="mt-2 text-lg font-medium text-white">{upcomingEventCount.count}</p>
          {upcomingEventCount.unavailable ? (
            <p className="mt-2 text-xs text-amber-300">Events table unavailable.</p>
          ) : null}
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Active Cameras</p>
          <p className="mt-2 text-lg font-medium text-white">
            {cameras.cameras.filter((camera) => camera.status === "enabled").length}
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Link href="/owner/venue" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Venue Details</p>
          <p className="mt-2 text-sm text-zinc-300">Update venue profile fields and live status.</p>
        </Link>
        <Link href="/owner/operations" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Operations</p>
          <p className="mt-2 text-sm text-zinc-300">Run of show, tasks, and incident tracking.</p>
        </Link>
        <Link href="/owner/staff" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Staff</p>
          <p className="mt-2 text-sm text-zinc-300">Directory, invites, roles, and certifications.</p>
        </Link>
        <Link href="/owner/scheduling" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Scheduling</p>
          <p className="mt-2 text-sm text-zinc-300">Shifts, availability, swaps, and attendance.</p>
        </Link>
        <Link href="/owner/floor" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Floor</p>
          <p className="mt-2 text-sm text-zinc-300">Interactive floor plans, VIP zones, and exits.</p>
        </Link>
        <Link href="/owner/vip" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">VIP</p>
          <p className="mt-2 text-sm text-zinc-300">Reservations, bottle packages, and arrivals.</p>
        </Link>
        <Link href="/owner/inventory" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Inventory</p>
          <p className="mt-2 text-sm text-zinc-300">Stock, suppliers, waste, and purchase orders.</p>
        </Link>
        <Link href="/owner/crm" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">CRM</p>
          <p className="mt-2 text-sm text-zinc-300">Guest profiles, spend, notes, and segmentation.</p>
        </Link>
        <Link href="/owner/marketing" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Marketing</p>
          <p className="mt-2 text-sm text-zinc-300">Campaign builder, promotions, and delivery hooks.</p>
        </Link>
        <Link href="/owner/loyalty" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Loyalty</p>
          <p className="mt-2 text-sm text-zinc-300">Points, tiers, rewards, and ledger history.</p>
        </Link>
        <Link href="/owner/reports" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Reports</p>
          <p className="mt-2 text-sm text-zinc-300">Revenue snapshots, insights, and nightly recap requests.</p>
        </Link>
        <Link href="/owner/hours" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Business Hours</p>
          <p className="mt-2 text-sm text-zinc-300">Set daily open/close windows and closed days.</p>
        </Link>
        <Link href="/owner/images" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Venue Images</p>
          <p className="mt-2 text-sm text-zinc-300">Add, delete, and reorder gallery images.</p>
        </Link>
        <Link href="/owner/events" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Events</p>
          <p className="mt-2 text-sm text-zinc-300">Create and manage venue event schedule.</p>
        </Link>
        {liveCamerasEnabled ? (
          <Link href="/owner/cameras" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
            <p className="text-sm font-semibold text-white">Cameras</p>
            <p className="mt-2 text-sm text-zinc-300">Manage Nightly Live stream cameras and primary feed.</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-white">Cameras</p>
            <p className="mt-2 text-sm text-zinc-300">Deferred from Beta V1.</p>
          </div>
        )}
        {betaOnlyFeaturesEnabled ? (
          <Link href="/owner/settings" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
            <p className="text-sm font-semibold text-white">Settings</p>
            <p className="mt-2 text-sm text-zinc-300">Membership details and upcoming management tools.</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-white">Settings</p>
            <p className="mt-2 text-sm text-zinc-300">Deferred from Beta V1.</p>
          </div>
        )}
        <Link href="/owner/profile-completion" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Profile Completion</p>
          <p className="mt-2 text-sm text-zinc-300">Submit profile updates for admin moderation.</p>
        </Link>
        <Link href="/owner/publishing" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          <p className="text-sm font-semibold text-white">Publishing</p>
          <p className="mt-2 text-sm text-zinc-300">Publish and unpublish with cache invalidation history.</p>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Missing Information</p>
          {missingItems.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-200">All key profile details are complete.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-200">
              {missingItems.map((item) => (
                <li key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Recent Activity</p>
          {recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No activity recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-200">
              {recentActivity.map((activity, index) => (
                <li key={`${activity.type}-${activity.createdAt.toISOString()}-${index}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p>{activity.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{activity.createdAt.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">VenueOS Modules</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-200">
            {[
              ["Operations", "/owner/operations"],
              ["Staff", "/owner/staff"],
              ["Scheduling", "/owner/scheduling"],
              ["VIP", "/owner/vip"],
              ["Inventory", "/owner/inventory"],
              ["Reports", "/owner/reports"],
            ].map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:border-cyan-400/40 hover:bg-cyan-500/10">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </div>

      {ownerEvents.unavailable ? (
        <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Event CRUD is enabled in the portal UI, but the backing `events` table is not available yet in this environment.
        </div>
      ) : null}
    </section>
  );
}
