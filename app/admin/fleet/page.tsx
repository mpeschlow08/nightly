import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { cancelFleetCanary, pruneFleetHistory, refreshFleetAlertState, scheduleFleetCanary } from "@/app/admin/fleet/actions";
import { db } from "@/db";
import { fleetDeviceAlerts, fleetUpdateRollouts, nightlyDeviceCommissioningChecks, nightlyDeviceSources, nightlyDevices, venues } from "@/db/schema";
import { evaluateFleetState } from "@/lib/nightly-device/policy";
import { evaluateCommissioning } from "@/lib/nightly-device/commissioning";

export default async function AdminFleetPage({ searchParams }: { searchParams: Promise<{ q?: string; severity?: string; state?: string }> }) {
  const actor = await requireAdminPermission("health:view");
  const filters = await searchParams;
  const query = filters.q?.trim().slice(0, 64) ?? "";
  const severity = ["info", "warning", "critical"].includes(filters.severity ?? "") ? filters.severity! : "";
  const alertState = ["open", "acknowledged", "resolved"].includes(filters.state ?? "") ? filters.state! : "";
  const alertMatch = severity || alertState ? sql`exists (select 1 from ${fleetDeviceAlerts} where ${fleetDeviceAlerts.deviceId} = ${nightlyDevices.id} and ${severity ? sql`${fleetDeviceAlerts.severity} = ${severity}` : sql`true`} and ${alertState ? sql`${fleetDeviceAlerts.state} = ${alertState}` : sql`true`})` : undefined;
  const [totals, devices, rollouts] = await Promise.all([
    db.select({
      total: count(),
      evaluatedAtMs: sql<number>`(extract(epoch from now()) * 1000)::bigint`,
      online: sql<number>`count(*) filter (where ${nightlyDevices.lastHeartbeatAt} >= now() - interval '2 minutes')::int`,
      offline: sql<number>`count(*) filter (where ${nightlyDevices.lastHeartbeatAt} < now() - interval '5 minutes')::int`,
      suspended: sql<number>`count(*) filter (where ${nightlyDevices.serviceEntitlementState} = 'suspended')::int`,
    }).from(nightlyDevices),
    db.select({ device: nightlyDevices, venueName: venues.name }).from(nightlyDevices)
      .leftJoin(venues, eq(nightlyDevices.venueId, venues.id))
      .where(and(query ? or(ilike(nightlyDevices.serialNumber, `%${query}%`), ilike(nightlyDevices.publicDeviceName, `%${query}%`), ilike(venues.name, `%${query}%`)) : undefined, alertMatch))
      .orderBy(desc(nightlyDevices.lastHeartbeatAt), desc(nightlyDevices.id)).limit(100),
    db.select({ id: fleetUpdateRollouts.id, version: fleetUpdateRollouts.targetVersion, state: fleetUpdateRollouts.state, createdAt: fleetUpdateRollouts.createdAt })
      .from(fleetUpdateRollouts).orderBy(desc(fleetUpdateRollouts.createdAt)).limit(10),
  ]);
  const ids = devices.map(({ device }) => device.id);
  const [checks, alerts, sources] = ids.length ? await Promise.all([
    db.select({ deviceId: nightlyDeviceCommissioningChecks.deviceId, checkKey: nightlyDeviceCommissioningChecks.checkKey, status: nightlyDeviceCommissioningChecks.status, evidenceJson: nightlyDeviceCommissioningChecks.evidenceJson })
      .from(nightlyDeviceCommissioningChecks).where(inArray(nightlyDeviceCommissioningChecks.deviceId, ids)),
    db.select({ deviceId: fleetDeviceAlerts.deviceId, active: count() }).from(fleetDeviceAlerts)
      .where(and(inArray(fleetDeviceAlerts.deviceId, ids), ne(fleetDeviceAlerts.state, "resolved")))
      .groupBy(fleetDeviceAlerts.deviceId),
    db.select({ deviceId: nightlyDeviceSources.deviceId, sourceType: nightlyDeviceSources.sourceType, enabled: nightlyDeviceSources.enabled })
      .from(nightlyDeviceSources).where(inArray(nightlyDeviceSources.deviceId, ids)),
  ]) : [[], [], []];
  const activeAlerts = new Map(alerts.map((row) => [row.deviceId, row.active]));
  const checksByDevice = new Map<number, typeof checks>();
  for (const check of checks) {
    const rows = checksByDevice.get(check.deviceId) ?? [];
    rows.push(check);
    checksByDevice.set(check.deviceId, rows);
  }
  const fleetRows = devices.map(({ device, venueName }) => {
    const now = Number(totals[0].evaluatedAtMs);
    const commissioning = evaluateCommissioning({ ...device, enrolled: !!device.deviceSecretHash, online: !!device.lastHeartbeatAt && now - device.lastHeartbeatAt.getTime() <= 2 * 60_000, commercialState: device.serviceEntitlementState, checks: checksByDevice.get(device.id) ?? [], sources: sources.filter((source) => source.deviceId === device.id), publicDeviceUuid: device.publicDeviceUuid });
    return { device, venueName, fleet: evaluateFleetState({ ...device, commissioningReady: commissioning.ready }, now) };
  });

  return <main className="space-y-5 text-zinc-100">
    <header><h1 className="text-2xl font-semibold">Fleet</h1><p className="text-sm text-zinc-400">Nightly Boxes and current operational state</p></header>
    <dl className="grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm sm:grid-cols-4">
      {[["Boxes", totals[0]?.total ?? 0], ["Recently online", totals[0]?.online ?? 0], ["Offline", totals[0]?.offline ?? 0], ["Suspended", totals[0]?.suspended ?? 0]].map(([label, value]) =>
        <div key={label}><dt className="text-zinc-400">{label}</dt><dd className="text-xl font-semibold">{value}</dd></div>)}
    </dl>
    <form method="get" className="flex flex-wrap gap-2"><input name="q" type="search" defaultValue={query} maxLength={64} placeholder="Search Box or venue" aria-label="Search Boxes" className="min-w-40 flex-1 border border-white/15 bg-zinc-950 px-3 py-2 text-sm" /><select name="severity" defaultValue={severity} aria-label="Alert severity" className="border border-white/15 bg-zinc-950 px-3 py-2 text-sm"><option value="">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select><select name="state" defaultValue={alertState} aria-label="Alert state" className="border border-white/15 bg-zinc-950 px-3 py-2 text-sm"><option value="">All alert states</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select><button type="submit" className="border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200">Filter</button></form>
    {(actor.isSuperAdmin || actor.permissions.has("jobs:manage")) && ids.length ? <form action={refreshFleetAlertState}>{ids.map((id) => <input key={id} type="hidden" name="deviceId" value={id} />)}<button type="submit" className="border border-white/15 px-3 py-2 text-sm text-zinc-200">Refresh alert state for listed Boxes</button></form> : null}
    {(actor.isSuperAdmin || actor.permissions.has("jobs:manage")) && ids.length ? <form action={pruneFleetHistory}>{ids.map((id) => <input key={id} type="hidden" name="deviceId" value={id} />)}<button type="submit" className="border border-white/15 px-3 py-2 text-sm text-zinc-200">Prune old resolved history</button></form> : null}
    {process.env.NIGHTLY_OTA_PUBLIC_KEY && (actor.isSuperAdmin || actor.permissions.has("jobs:manage")) && fleetRows.length ? <section className="border-y border-white/10 py-4"><h2 className="text-base font-semibold">Canary rollout</h2><form action={scheduleFleetCanary} className="mt-3 grid gap-3"><div className="flex flex-wrap gap-x-5 gap-y-2">{fleetRows.slice(0, 5).map(({ device }) => <label key={device.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="deviceId" value={device.id} className="accent-cyan-400" />{device.publicDeviceName || device.serialNumber}</label>)}</div><textarea name="manifest" required maxLength={2048} aria-label="Signed update manifest" className="min-h-24 w-full border border-white/15 bg-zinc-950 p-3 font-mono text-xs" /><button type="submit" className="justify-self-start border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200">Schedule canary</button></form></section> : null}
    {rollouts.length ? <section className="border-b border-white/10 pb-4"><h2 className="text-base font-semibold">Recent rollouts</h2><ul className="mt-2 divide-y divide-white/10 text-sm">{rollouts.map((rollout) => <li key={rollout.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>Version {rollout.version} · {rollout.state} · {rollout.createdAt.toLocaleString()}</span>{rollout.state === "scheduled" && (actor.isSuperAdmin || actor.permissions.has("jobs:manage")) ? <form action={cancelFleetCanary}><input type="hidden" name="rolloutId" value={rollout.id} /><button type="submit" className="text-cyan-200 hover:underline">Cancel</button></form> : null}</li>)}</ul></section> : null}
    <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-zinc-400"><tr>{["Device", "Venue", "State", "Health", "Service", "Agent", "Last seen", "Alerts"].map((name) => <th key={name} className="px-2 py-2 font-medium">{name}</th>)}</tr></thead><tbody>
      {fleetRows.map(({ device, venueName, fleet }) => <tr key={device.id} className="border-t border-white/10">
        <td className="px-2 py-3"><Link className="text-cyan-200 hover:underline" href={`/admin/fleet/${device.id}`}>{device.publicDeviceName || device.serialNumber}</Link></td>
        <td className="px-2 py-3">{venueName ?? "Unassigned"}</td><td className="px-2 py-3 capitalize">{fleet.state.replaceAll("_", " ")}</td><td className="px-2 py-3 capitalize">{fleet.health}</td>
        <td className="px-2 py-3 capitalize">{fleet.commercialState}</td><td className="px-2 py-3">{device.agentVersion ?? "Unknown"}</td>
        <td className="px-2 py-3">{device.lastHeartbeatAt?.toLocaleString() ?? "Never"}</td><td className="px-2 py-3">{activeAlerts.get(device.id) ?? 0}</td>
      </tr>)}
    </tbody></table>{fleetRows.length === 0 ? <p className="py-8 text-sm text-zinc-400">No Boxes found.</p> : null}</div>
  </main>;
}