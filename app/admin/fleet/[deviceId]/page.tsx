import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";

import { acknowledgeFleetAlert, createFleetSupportGrant, requestFleetHealthCheck, revokeFleetSupportGrant } from "@/app/admin/fleet/actions";
import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { fleetDeviceAlerts, fleetDeviceOperations, fleetDeviceSnapshots, fleetSupportGrants, fleetUpdateRollouts, fleetUpdateTargets, nightlyDeviceCommissioningChecks, nightlyDeviceSources, nightlyDevices, venues } from "@/db/schema";
import { evaluateFleetState } from "@/lib/nightly-device/policy";
import { evaluateCommissioning } from "@/lib/nightly-device/commissioning";
import { parseFleetTelemetry } from "@/lib/nightly-device/telemetry";

export default async function AdminFleetDevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const actor = await requireAdminPermission("health:view");
  const canSupport = actor.isSuperAdmin || actor.permissions.has("support:resolve");
  const { deviceId } = await params;
  if (!/^\d{1,10}$/.test(deviceId) || !Number.isSafeInteger(Number(deviceId)) || Number(deviceId) <= 0) notFound();
  const [device] = await db.select({ device: nightlyDevices, venueName: venues.name }).from(nightlyDevices)
    .leftJoin(venues, eq(nightlyDevices.venueId, venues.id))
    .where(eq(nightlyDevices.id, Number(deviceId))).limit(1);
  if (!device) notFound();

  const [checks, snapshots, alerts, sources, operations, grants, clock, updates] = await Promise.all([
    db.select({ checkKey: nightlyDeviceCommissioningChecks.checkKey, status: nightlyDeviceCommissioningChecks.status, evidenceJson: nightlyDeviceCommissioningChecks.evidenceJson })
      .from(nightlyDeviceCommissioningChecks).where(eq(nightlyDeviceCommissioningChecks.deviceId, device.device.id)),
    db.select({ telemetryJson: fleetDeviceSnapshots.telemetryJson, receivedAt: fleetDeviceSnapshots.receivedAt })
      .from(fleetDeviceSnapshots).where(eq(fleetDeviceSnapshots.deviceId, device.device.id)).limit(1),
    db.select({ id: fleetDeviceAlerts.id, code: fleetDeviceAlerts.code, severity: fleetDeviceAlerts.severity, state: fleetDeviceAlerts.state, occurrences: fleetDeviceAlerts.occurrenceCount, lastObservedAt: fleetDeviceAlerts.lastObservedAt })
      .from(fleetDeviceAlerts).where(eq(fleetDeviceAlerts.deviceId, device.device.id)).orderBy(desc(fleetDeviceAlerts.lastObservedAt)).limit(40),
    db.select({ sourceType: nightlyDeviceSources.sourceType, enabled: nightlyDeviceSources.enabled }).from(nightlyDeviceSources)
      .where(eq(nightlyDeviceSources.deviceId, device.device.id)).limit(100),
    db.select({ type: fleetDeviceOperations.type, state: fleetDeviceOperations.state, resultCode: fleetDeviceOperations.resultCode, createdAt: fleetDeviceOperations.createdAt })
      .from(fleetDeviceOperations).where(eq(fleetDeviceOperations.deviceId, device.device.id)).orderBy(desc(fleetDeviceOperations.createdAt)).limit(20),
    canSupport ? db.select({ id: fleetSupportGrants.id, scope: fleetSupportGrants.scope, expiresAt: fleetSupportGrants.expiresAt, revokedAt: fleetSupportGrants.revokedAt, active: sql<boolean>`${fleetSupportGrants.revokedAt} is null and ${fleetSupportGrants.expiresAt} > now()` })
      .from(fleetSupportGrants).where(and(eq(fleetSupportGrants.deviceId, device.device.id), eq(fleetSupportGrants.actorClerkUserId, actor.clerkUserId))).orderBy(desc(fleetSupportGrants.createdAt)).limit(10) : Promise.resolve([]),
    db.select({ nowMs: sql<number>`(extract(epoch from now()) * 1000)::bigint` }).from(nightlyDevices).where(eq(nightlyDevices.id, device.device.id)).limit(1),
    db.select({ version: fleetUpdateRollouts.targetVersion, state: fleetUpdateTargets.state, updatedAt: fleetUpdateTargets.updatedAt })
      .from(fleetUpdateTargets).innerJoin(fleetUpdateRollouts, eq(fleetUpdateTargets.rolloutId, fleetUpdateRollouts.id))
      .where(eq(fleetUpdateTargets.deviceId, device.device.id)).orderBy(desc(fleetUpdateTargets.updatedAt)).limit(20),
  ]);
  const evaluatedAt = Number(clock[0].nowMs);
  const commissioning = evaluateCommissioning({ ...device.device, enrolled: !!device.device.deviceSecretHash, online: !!device.device.lastHeartbeatAt && evaluatedAt - device.device.lastHeartbeatAt.getTime() <= 2 * 60_000, commercialState: device.device.serviceEntitlementState, checks, sources, publicDeviceUuid: device.device.publicDeviceUuid });
  const fleet = evaluateFleetState({ ...device.device, commissioningReady: commissioning.ready }, evaluatedAt);
  let telemetry = null;
  try { telemetry = parseFleetTelemetry(JSON.parse(snapshots[0]?.telemetryJson ?? "null")); } catch { telemetry = null; }

  return <main className="space-y-6 text-zinc-100">
    <header className="border-b border-white/10 pb-4"><Link href="/admin/fleet" className="text-sm text-cyan-200 hover:underline">Fleet</Link><h1 className="mt-2 text-2xl font-semibold">{device.device.publicDeviceName || device.device.serialNumber}</h1><p className="text-sm text-zinc-400">{device.venueName ?? "Unassigned"} · Last seen {device.device.lastHeartbeatAt?.toLocaleString() ?? "Never"}</p></header>
    <dl className="grid gap-4 border-b border-white/10 pb-5 text-sm sm:grid-cols-3">
      {[["State", fleet.state], ["Health", fleet.health], ["Connectivity", fleet.connectivity], ["Commercial", fleet.commercialState], ["Agent", device.device.agentVersion ?? "Unknown"], ["Software", device.device.softwareVersion ?? "Unknown"]].map(([label, value]) => <div key={label}><dt className="text-zinc-400">{label}</dt><dd className="mt-1 capitalize">{value.replaceAll("_", " ")}</dd></div>)}
    </dl>
    <section><h2 className="text-lg font-semibold">Health</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-zinc-400">Uptime</dt><dd>{telemetry ? `${Math.floor(telemetry.uptimeSeconds / 3600)} hours` : "Not reported"}</dd></div>
      <div><dt className="text-zinc-400">Memory available</dt><dd>{telemetry ? `${Math.round(100 * telemetry.memoryAvailableBytes / telemetry.memoryTotalBytes)}%` : "Not reported"}</dd></div>
      <div><dt className="text-zinc-400">Last telemetry</dt><dd>{snapshots[0]?.receivedAt.toLocaleString() ?? "Not reported"}</dd></div>
    </dl></section>
    <section><h2 className="text-lg font-semibold">Commissioning</h2><ul className="mt-2 divide-y divide-white/10 text-sm">{commissioning.steps.map((step) => <li key={step.key} className="flex justify-between gap-3 py-2"><span className="capitalize">{step.key.replaceAll("_", " ")}</span><span className="text-zinc-400 capitalize">{step.status}</span></li>)}</ul></section>
    <section><h2 className="text-lg font-semibold">Sources</h2><p className="mt-2 text-sm text-zinc-300">{sources.length ? [...new Set(sources.map((source) => source.sourceType))].map((type) => `${type.replaceAll("_", " ")}: ${sources.filter((source) => source.sourceType === type && source.enabled).length}`).join(" · ") : "None enrolled"}</p></section>
    <section><h2 className="text-lg font-semibold">Alerts</h2><ul className="mt-2 divide-y divide-white/10 text-sm">{alerts.map((alert) => <li key={alert.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{alert.code.replaceAll("_", " ")}</span><span className="flex items-center gap-3 text-zinc-400">{alert.severity} · {alert.state} · {alert.occurrences} observations{canSupport && alert.state === "open" ? <form action={acknowledgeFleetAlert}><input type="hidden" name="deviceId" value={device.device.id} /><input type="hidden" name="alertId" value={alert.id} /><button type="submit" className="text-cyan-200 hover:underline">Acknowledge</button></form> : null}</span></li>)}</ul>{alerts.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No alerts.</p> : null}</section>
    <section><h2 className="text-lg font-semibold">Operations</h2><ul className="mt-2 divide-y divide-white/10 text-sm">{operations.map((operation, index) => <li key={`${operation.type}-${index}`} className="flex flex-wrap justify-between gap-2 py-2"><span>{operation.type.replaceAll("_", " ")}</span><span className="text-zinc-400">{operation.state} · {operation.resultCode ?? operation.createdAt.toLocaleString()}</span></li>)}</ul>{operations.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No operations requested.</p> : null}</section>
    <section><h2 className="text-lg font-semibold">Updates</h2><ul className="mt-2 divide-y divide-white/10 text-sm">{updates.map((update, index) => <li key={`${update.version}-${index}`} className="flex justify-between gap-3 py-2"><span>Version {update.version}</span><span className="text-zinc-400 capitalize">{update.state.replaceAll("_", " ")}</span></li>)}</ul>{updates.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No updates scheduled.</p> : null}</section>
    {canSupport ? <section className="border-t border-white/10 pt-4"><h2 className="text-lg font-semibold">Support access</h2>
      <form action={createFleetSupportGrant} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="deviceId" value={device.device.id} /><select name="scope" aria-label="Support scope" className="border border-white/15 bg-zinc-950 px-3 py-2 text-sm"><option value="device.read_diagnostics">Read diagnostics</option><option value="device.request_health_check">Request health check</option><option value="device.collect_support_bundle">Collect support bundle</option></select><button type="submit" className="border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200">Authorize 15 minutes</button></form>
      <ul className="mt-3 divide-y divide-white/10 text-sm">{grants.map((grant) => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{grant.scope.replaceAll("_", " ")} · {grant.revokedAt ? "Revoked" : grant.active ? `Expires ${grant.expiresAt.toLocaleTimeString()}` : "Expired"}</span><div className="flex gap-4">{grant.active && grant.scope === "device.request_health_check" ? <form action={requestFleetHealthCheck}><input type="hidden" name="deviceId" value={device.device.id} /><input type="hidden" name="grantId" value={grant.id} /><button type="submit" className="text-cyan-200 hover:underline">Request health check</button></form> : null}{grant.active && grant.scope === "device.collect_support_bundle" ? <form action={`/api/admin/fleet/${device.device.id}/support-bundle`} method="post"><button type="submit" className="text-cyan-200 hover:underline">Download bundle</button></form> : null}{grant.active ? <form action={revokeFleetSupportGrant}><input type="hidden" name="deviceId" value={device.device.id} /><input type="hidden" name="grantId" value={grant.id} /><button type="submit" className="text-cyan-200 hover:underline">Revoke</button></form> : null}</div></li>)}</ul>
    </section> : null}
  </main>;
}