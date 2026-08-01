import { notFound } from "next/navigation";

import { getSectionPreview } from "@/app/admin/lib/control-center-data";
import { requireAdminActor } from "@/app/admin/lib/permissions";

const SECTION_DEFS: Record<string, { title: string; description: string }> = {
  organizations: { title: "Organizations", description: "Venue organization oversight and governance." },
  "venue-claims": { title: "Venue Claim Review", description: "Claim approvals, conflicts, and provenance checks." },
  tickets: { title: "Ticket Operations", description: "Ticket state, scans, transfers, and override diagnostics." },
  orders: { title: "Order Operations", description: "Ticket order tracking and financial status review." },
  refunds: { title: "Refund Center", description: "Refund request and provider-confirmation workflow view." },
  disputes: { title: "Dispute Center", description: "Chargeback and dispute review queue." },
  fraud: { title: "Fraud Control Center", description: "Signals, cases, severity, assignment, and resolution state." },
  reports: { title: "Reports", description: "Operational and trust-and-safety report snapshots." },
  moderation: { title: "Moderation Center", description: "Moderation report queue and enforcement decisions." },
  social: { title: "Social Safety", description: "Social Circle abuse/report review with report-scoped access." },
  concierge: { title: "Concierge Administration", description: "Usage, fallback, and quality diagnostics (redacted)." },
  intelligence: { title: "Venue Intelligence Admin", description: "Run health, snapshot freshness, and adoption trends." },
  notifications: { title: "Notification Operations", description: "Outbox and provider delivery operational view." },
  revenue: { title: "Revenue & Finance", description: "Confirmed and pending transaction visibility by status." },
  subscriptions: { title: "Subscription Operations", description: "Plan and entitlement operational state." },
  support: { title: "Support Center", description: "Case operations and SLA metadata." },
  audit: { title: "Audit Log Center", description: "Append-only sensitive action history with before/after state." },
  system: { title: "System Health", description: "Platform health checks and provider health state." },
  jobs: { title: "Background Jobs", description: "Job registry and run outcomes; adapter-ready where needed." },
  exports: { title: "Exports & Privacy", description: "Export jobs and privacy request workflows." },
  settings: { title: "Platform Settings", description: "Non-destructive admin configuration surface." },
  incidents: { title: "Incident Response", description: "Active incidents, impact, timeline, and resolution tracking." },
  feedback: { title: "Beta Feedback", description: "Internal beta feedback queue and triage status." },
  "launch-readiness": { title: "Launch Readiness", description: "Evidence-based readiness snapshots and blockers." },
};

export default async function AdminGenericSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  await requireAdminActor();
  const { section } = await params;
  const def = SECTION_DEFS[section];

  if (!def) {
    notFound();
  }

  const preview = await getSectionPreview(section);

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-white">{def.title}</h1>
        <p className="text-sm text-zinc-300">{def.description}</p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Operational snapshot</p>
        <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(preview, null, 2)}</pre>
      </section>
    </main>
  );
}
