import Link from "next/link";

import { createCampaignDraftAction, runIntelligenceSnapshotAction, submitInsightFeedbackAction } from "@/app/owner/intelligence/actions";
import type { IntelligenceOverview } from "@/lib/venue-intelligence/types";

type ModuleKey = "overview" | "events" | "customers" | "marketing" | "staffing" | "inventory" | "revenue" | "reports";

const tabs: Array<{ key: ModuleKey; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/owner/intelligence/overview" },
  { key: "events", label: "Events", href: "/owner/intelligence/events" },
  { key: "customers", label: "Customers", href: "/owner/intelligence/customers" },
  { key: "marketing", label: "Marketing", href: "/owner/intelligence/marketing" },
  { key: "staffing", label: "Staffing", href: "/owner/intelligence/staffing" },
  { key: "inventory", label: "Inventory", href: "/owner/intelligence/inventory" },
  { key: "revenue", label: "Revenue", href: "/owner/intelligence/revenue" },
  { key: "reports", label: "Reports", href: "/owner/intelligence/reports" },
];

function scoreTone(score: number | null) {
  if (score == null) return "text-zinc-300";
  if (score >= 80) return "text-emerald-200";
  if (score >= 60) return "text-cyan-200";
  if (score >= 40) return "text-amber-200";
  return "text-rose-200";
}

export default function OwnerIntelligenceDashboard({
  moduleKey,
  overview,
}: {
  moduleKey: ModuleKey;
  overview: IntelligenceOverview;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_36%),radial-gradient(circle_at_80%_0%,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(140deg,_#04070b_0%,_#0b1220_52%,_#101827_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(45,212,191,0.1)] backdrop-blur-xl sm:p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-teal-200/80">AI Venue Intelligence</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Nightly Intelligence Suite</h1>
        <p className="mt-3 max-w-4xl text-base text-zinc-300">Structured forecasts and recommendations are venue-scoped, provenance-tagged, and confidence-scored. Deterministic mode is always available.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link key={tab.key} href={tab.href} className={`rounded-full border px-4 py-2 text-sm ${moduleKey === tab.key ? "border-teal-300/45 bg-teal-500/15 text-teal-100" : "border-white/10 bg-white/5 text-zinc-200"}`}>
              {tab.label}
            </Link>
          ))}
          <Link href="/owner/intelligence/ask" className="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-4 py-2 text-sm text-fuchsia-100">Ask Nightly</Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Performance score</p>
            <p className={`mt-2 text-3xl font-semibold ${scoreTone(overview.scorecard.compositeScore)}`}>{overview.scorecard.compositeScore ?? "N/A"}</p>
            <p className="mt-1 text-xs text-zinc-500">{overview.scorecard.scoreVersion}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Attendance forecast</p>
            <p className="mt-2 text-2xl font-semibold text-white">{overview.attendanceForecast.expected}</p>
            <p className="mt-1 text-xs text-zinc-500">Range {overview.attendanceForecast.low}-{overview.attendanceForecast.high}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Confirmed net</p>
            <p className="mt-2 text-2xl font-semibold text-white">${Math.round(overview.revenueForecast.confirmedNetCents / 100).toLocaleString()}</p>
            <p className="mt-1 text-xs text-zinc-500">Estimated +${Math.round(overview.revenueForecast.estimatedNetCents / 100).toLocaleString()}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Open anomalies</p>
            <p className="mt-2 text-2xl font-semibold text-white">{overview.anomalies.length}</p>
            <p className="mt-1 text-xs text-zinc-500">Status: {overview.anomalies.length > 0 ? "review" : "clear"}</p>
          </article>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={runIntelligenceSnapshotAction}>
            <input type="hidden" name="reason" value="manual_owner_refresh" />
            <button type="submit" className="rounded-full border border-teal-300/30 bg-teal-500/15 px-5 py-3 text-sm font-medium text-teal-100">Refresh snapshot</button>
          </form>
          <form action={createCampaignDraftAction}>
            <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-5 py-3 text-sm font-medium text-cyan-100">Create campaign draft</button>
          </form>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Top Recommendations</h2>
            <div className="mt-4 space-y-3">
              {overview.marketingRecommendations.length === 0 ? <p className="text-sm text-zinc-500">No recommendations yet.</p> : null}
              {overview.marketingRecommendations.slice(0, 4).map((rec) => (
                <article key={rec.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{rec.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{rec.goal} • {rec.channel} • {rec.timing}</p>
                  <p className="mt-2 text-sm text-zinc-300">{rec.expectedReason}</p>
                  <p className="mt-2 text-xs text-zinc-500">Confidence {rec.confidenceLevel} • {rec.provenance.status}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Anomaly Center</h2>
            <div className="mt-4 space-y-3">
              {overview.anomalies.length === 0 ? <p className="text-sm text-zinc-500">No anomalous trends detected.</p> : null}
              {overview.anomalies.map((anomaly) => (
                <article key={`${anomaly.metric}-${anomaly.actualValue}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{anomaly.metric}</p>
                  <p className="mt-1 text-xs text-zinc-400">Expected {anomaly.expectedRange} • Actual {anomaly.actualValue}</p>
                  <p className="mt-2 text-sm text-zinc-300">{anomaly.recommendedInvestigation}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-amber-200">{anomaly.severity} severity</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">Recommendation Feedback</h2>
          <p className="mt-2 text-sm text-zinc-400">Feedback updates ranking but does not auto-apply operational changes.</p>
          <form action={submitInsightFeedbackAction} className="mt-4 grid gap-3 md:grid-cols-4">
            <input name="recommendationId" type="number" min={1} placeholder="Recommendation ID" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" />
            <select name="feedbackType" defaultValue="helpful" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white">
              <option value="helpful">Helpful</option>
              <option value="not_helpful">Not helpful</option>
              <option value="already_handled">Already handled</option>
              <option value="incorrect_data">Incorrect data</option>
              <option value="too_risky">Too risky</option>
              <option value="not_relevant">Not relevant</option>
              <option value="dismiss">Dismiss</option>
              <option value="snooze">Snooze</option>
              <option value="applied">Applied</option>
            </select>
            <input name="notes" placeholder="Optional note" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" />
            <button type="submit" className="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-4 py-3 text-sm font-medium text-fuchsia-100">Submit feedback</button>
          </form>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">Module Highlights</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.customerSegments.slice(0, 3).map((segment) => (
              <article key={segment.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">{segment.label}</p>
                <p className="mt-1 text-xs text-zinc-400">Audience {segment.audienceSize} • {segment.status}</p>
                <p className="mt-2 text-sm text-zinc-300">{segment.objective}</p>
              </article>
            ))}
            {overview.inventoryRisks.slice(0, 3).map((risk) => (
              <article key={risk.itemId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">{risk.itemName}</p>
                <p className="mt-1 text-xs text-zinc-400">Shortage risk {Math.round(risk.shortageRisk * 100)}%</p>
                <p className="mt-2 text-sm text-zinc-300">Reorder {risk.reorderQuantity}</p>
              </article>
            ))}
            {overview.pricingRecommendations.slice(0, 2).map((pricing) => (
              <article key={`${pricing.productType}-${pricing.currentPriceCents}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">{pricing.productType}</p>
                <p className="mt-1 text-xs text-zinc-400">Current ${Math.round(pricing.currentPriceCents / 100)}</p>
                <p className="mt-2 text-sm text-zinc-300">Suggested ${Math.round(pricing.suggestedLowCents / 100)}-${Math.round(pricing.suggestedHighCents / 100)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
