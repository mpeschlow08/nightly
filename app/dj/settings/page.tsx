import Link from "next/link";
import { requireDjProfileForDashboard } from "../lib/data";

export default async function DjSettingsPage() {
  await requireDjProfileForDashboard();
  return <main className="nightly-page mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:px-8"><Link href="/dj/dashboard" className="text-sm text-[color:var(--text-secondary)] hover:text-white">Back to Artist Dashboard</Link><section className="nightly-card-hero mt-4 rounded-[1.7rem] p-5 sm:p-7"><p className="nightly-eyebrow">Artist settings</p><h1 className="nightly-display nightly-accent-heading mt-2">Keep your performance world tidy.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Profile, media, connected social accounts, notifications, privacy, and help stay in their existing authorized surfaces.</p></section><div className="mt-6 grid gap-3 sm:grid-cols-2">{[["Profile", "/dj/onboarding?edit=1"],["Mixes", "/dj/mixes"],["Social accounts", "/owner/publishing"],["Help", "/profile/help"]].map(([label, href]) => <Link key={href} href={href} className="nightly-card nightly-card-interactive rounded-[1.25rem] p-5 text-base font-semibold text-white">{label}</Link>)}</div></main>;
}
