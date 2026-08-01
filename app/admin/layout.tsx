import Link from "next/link";

import { requireAdminActor } from "@/app/admin/lib/permissions";

const NAV_GROUPS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: "Overview",
    items: [
      { href: "/admin/overview", label: "Overview" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/system", label: "System" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/djs", label: "DJs" },
      { href: "/admin/support", label: "Support" },
      { href: "/admin/subscriptions", label: "Subscriptions" },
    ],
  },
  {
    title: "Businesses",
    items: [
      { href: "/admin/venues", label: "Venues" },
      { href: "/admin/organizations", label: "Organizations" },
      { href: "/admin/venue-claims", label: "Venue Claims" },
      { href: "/admin/intelligence", label: "Intelligence" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/events", label: "Events" },
      { href: "/admin/moderation", label: "Moderation" },
      { href: "/admin/social", label: "Social Safety" },
      { href: "/admin/concierge", label: "Concierge" },
      { href: "/admin/notifications", label: "Notifications" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/tickets", label: "Tickets" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/refunds", label: "Refunds" },
      { href: "/admin/disputes", label: "Disputes" },
      { href: "/admin/fraud", label: "Fraud" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/audit", label: "Audit" },
      { href: "/admin/incidents", label: "Incidents" },
      { href: "/admin/feedback", label: "Beta Feedback" },
      { href: "/admin/feature-flags", label: "Feature Flags" },
      { href: "/admin/jobs", label: "Jobs" },
      { href: "/admin/launch-readiness", label: "Launch Readiness" },
      { href: "/admin/exports", label: "Exports" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let actor: Awaited<ReturnType<typeof requireAdminActor>> | null = null;

  try {
    actor = await requireAdminActor();
  } catch {
    actor = null;
  }

  if (!actor) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#06090f,#0b1324_40%,#0f172a)] text-zinc-100">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
          <section className="w-full rounded-2xl border border-amber-300/25 bg-zinc-950/70 p-6 text-center shadow-[0_0_50px_rgba(245,158,11,0.08)] backdrop-blur sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">Permission Denied</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Admin access is required</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Your account does not have an active admin assignment for this workspace.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/home"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan-300/35 hover:bg-cyan-500/10"
              >
                Return Home
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full border border-amber-300/35 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/20"
              >
                Sign in as Admin
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#06090f,#0b1324_40%,#0f172a)] text-zinc-100">
      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[280px_1fr] lg:px-6">
        <aside className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 backdrop-blur">
          <div className="mb-4 rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Nightly Admin</p>
            <p className="mt-1 text-sm text-white">{actor.clerkUserId}</p>
            <p className="text-xs text-zinc-300">{actor.isSuperAdmin ? "Super Admin" : "Limited Admin"}</p>
          </div>

          <nav className="space-y-5" aria-label="Admin navigation">
            {NAV_GROUPS.map((group) => (
              <section key={group.title} className="space-y-2">
                <h2 className="text-xs uppercase tracking-[0.18em] text-zinc-400">{group.title}</h2>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block rounded-lg border border-transparent px-2 py-1.5 text-sm text-zinc-200 transition hover:border-cyan-300/30 hover:bg-cyan-500/10 hover:text-white"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_0_50px_rgba(34,211,238,0.08)] backdrop-blur sm:p-6">
          {children}
        </section>
      </div>
    </div>
  );
}
