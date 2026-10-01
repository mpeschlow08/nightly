import Link from "next/link";
import AccountPageShell from "@/components/account/AccountPageShell";

export default function SettingsPage() {
  const items = [
    ["Privacy", "/profile/privacy", "Control profile, friend, and location visibility."],
    ["Notifications", "/profile/notifications", "Review your Nightly notification history and preferences."],
    ["Premium", "/profile/premium", "See your current Hot Reel access and Premium state."],
    ["Help and support", "/profile/help", "Get help with reservations, account access, and privacy."],
  ];
  return <AccountPageShell eyebrow="Account" title="Settings that stay simple." description="Choose the part of Nightly you want to tune."><div className="grid gap-3 sm:grid-cols-2">{items.map(([title, href, description]) => <Link key={href} href={href} className="nightly-card nightly-card-interactive rounded-[1.25rem] p-5"><h2 className="text-base font-semibold text-white">{title}</h2><p className="mt-2 text-sm text-[color:var(--text-secondary)]">{description}</p></Link>)}</div></AccountPageShell>;
}
