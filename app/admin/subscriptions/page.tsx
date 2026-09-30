import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { listCommercialSubscriptions } from "@/lib/commercial-entitlements/service";

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }) : "-";
}

export default async function AdminSubscriptionsPage() {
  await requireAdminPermission("subscriptions:view");
  const subscriptions = await listCommercialSubscriptions();
  return (
    <main className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-cyan-200">Commercial control</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Subscriptions and entitlements</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Commercial state is separate from actor permissions and controls access by scope and capability.</p>
      </header>
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/50">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-zinc-500">
            <tr><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Trial ends</th><th className="px-4 py-3">Grace until</th><th className="px-4 py-3">Ends</th><th className="px-4 py-3">Revision</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-200">
            {subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td className="px-4 py-3">{subscription.scopeType} {subscription.scopeId}</td>
                <td className="px-4 py-3">{subscription.product === "venue_package" ? "Nightly venue package" : subscription.product === "consumer_premium" ? "Consumer Premium" : "Artist subscription"}</td>
                <td className="px-4 py-3"><span className="rounded border border-white/10 px-2 py-1 text-xs">{subscription.state.replaceAll("_", " ")}</span></td>
                <td className="px-4 py-3">{displayDate(subscription.trialEndsAt)}</td>
                <td className="px-4 py-3">{displayDate(subscription.graceUntil)}</td>
                <td className="px-4 py-3">{displayDate(subscription.endsAt)}</td>
                <td className="px-4 py-3">{subscription.revision}</td>
              </tr>
            ))}
            {subscriptions.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No commercial subscriptions recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}