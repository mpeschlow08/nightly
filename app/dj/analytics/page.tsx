import Link from "next/link";
import { requireDjProfileForDashboard } from "../lib/data";

export default async function DjAnalyticsPage() {
  await requireDjProfileForDashboard();
  return <main className="nightly-page mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:px-8"><Link href="/dj/dashboard" className="text-sm text-[color:var(--text-secondary)] hover:text-white">Back to Artist Dashboard</Link><section className="nightly-card-hero mt-4 rounded-[1.7rem] p-5 sm:p-7"><p className="nightly-eyebrow">Performance insights</p><h1 className="nightly-display nightly-accent-heading mt-2">See what is resonating.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Analytics will appear as sessions, approved moments, and published media accumulate.</p></section><div className="mt-6 grid gap-3 sm:grid-cols-3">{["Sessions", "Hot Moments", "Published Reels"].map((label) => <article key={label} className="nightly-surface p-5"><p className="nightly-eyebrow">{label}</p><p className="mt-4 text-3xl font-semibold text-white">--</p><p className="mt-2 text-xs text-[color:var(--text-muted)]">Not enough history yet</p></article>)}</div></main>;
}
