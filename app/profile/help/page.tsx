import Link from "next/link";
import AccountPageShell from "@/components/account/AccountPageShell";

export default function HelpPage() {
  const topics = ["Reservation help", "Account access", "Premium and billing", "Social and privacy", "Safety and reporting"];
  return <AccountPageShell eyebrow="Support" title="Help for the night ahead." description="Start with the area that needs attention. Nightly keeps support direct and human-readable."><div className="grid gap-3 sm:grid-cols-2">{topics.map((topic) => <Link key={topic} href="/profile" className="nightly-card nightly-card-interactive rounded-[1.25rem] p-5"><h2 className="text-base font-semibold text-white">{topic}</h2><p className="mt-2 text-sm text-[color:var(--text-secondary)]">Open your profile or reservation details for the current account context.</p></Link>)}</div></AccountPageShell>;
}
