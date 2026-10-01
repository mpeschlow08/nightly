import { asc, eq, sql } from "drizzle-orm";

import DeviceClaimForm from "@/components/venue-os/DeviceClaimForm";
import { requestOwnerDeviceRecheck } from "./actions";
import { db } from "@/db";
import {
  nightlyDeviceCommissioningChecks,
  nightlyDeviceSources,
  nightlyDevices,
  venueCameras,
} from "@/db/schema";
import { evaluateFleetState, normalizeCommissioningStatus } from "@/lib/nightly-device/policy";
import { evaluateCommissioning } from "@/lib/nightly-device/commissioning";
import { getCurrentVenueDeviceActor } from "@/lib/nightly-device/auth";

function badgeClass(status: string) {
  if (status === "READY") return "border-emerald-300/35 bg-emerald-400/10 text-emerald-200";
  if (status === "SUSPENDED" || status === "OFFLINE") return "border-rose-300/35 bg-rose-400/10 text-rose-200";
  if (status === "COMMISSIONING" || status === "PROVISIONING" || status === "DEGRADED") return "border-amber-300/35 bg-amber-400/10 text-amber-200";
  return "border-zinc-300/20 bg-white/5 text-zinc-300";
}

export default async function OwnerDevicesPage() {
  const actor = await getCurrentVenueDeviceActor();
  if (!actor) {
    return <main className="px-4 py-10 text-center text-sm text-zinc-400">Venue device access is not available for this account.</main>;
  }

  const [devices, cameras, sources, commissioning, clock] = await Promise.all([
    db.select().from(nightlyDevices).where(eq(nightlyDevices.venueId, actor.venueId)).orderBy(asc(nightlyDevices.id)),
    db.select({ id: venueCameras.id }).from(venueCameras).where(eq(venueCameras.venueId, actor.venueId)),
    db.select().from(nightlyDeviceSources).where(eq(nightlyDeviceSources.venueId, actor.venueId)),
    db.select().from(nightlyDeviceCommissioningChecks).innerJoin(nightlyDevices, eq(nightlyDevices.id, nightlyDeviceCommissioningChecks.deviceId)).where(eq(nightlyDevices.venueId, actor.venueId)),
    db.select({ nowMs: sql<number>`(extract(epoch from now()) * 1000)::bigint` }).from(nightlyDevices).where(eq(nightlyDevices.venueId, actor.venueId)).limit(1),
  ]);
  const evaluatedAt = Number(clock[0]?.nowMs ?? 0);

  const checksByDevice = new Map<number, Array<{ checkKey: typeof nightlyDeviceCommissioningChecks.$inferSelect.checkKey; status: typeof nightlyDeviceCommissioningChecks.$inferSelect.status; evidenceJson: string }>>();
  for (const row of commissioning) {
    const checks = checksByDevice.get(row.nightly_device_commissioning_checks.deviceId) ?? [];
    checks.push({ checkKey: row.nightly_device_commissioning_checks.checkKey, status: normalizeCommissioningStatus(row.nightly_device_commissioning_checks.status), evidenceJson: row.nightly_device_commissioning_checks.evidenceJson });
    checksByDevice.set(row.nightly_device_commissioning_checks.deviceId, checks);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,#070a0e_0%,#111820_55%,#091014_100%)] px-4 py-7 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">VenueOS / Devices</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">Nightly Box</h1>
              <p className="mt-1 text-sm text-zinc-400">{actor.venueName} · device health and commissioning</p>
            </div>
            <span className="text-sm text-zinc-400">{devices.length} assigned</span>
          </div>
        </header>

        {actor.role === "owner" ? (
          <section className="mt-5 border-b border-white/10 pb-4">
            <h2 className="px-1 text-sm font-semibold text-white">Claim a device</h2>
            <p className="px-1 pt-1 text-xs text-zinc-400">Enter the device ID and one-time claim code supplied with your Nightly Box.</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
              <DeviceClaimForm venueId={actor.venueId} />
            </div>
          </section>
        ) : null}

        {devices.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">No Nightly Box is assigned to this venue.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {devices.map((device) => {
              const deviceSources = sources.filter((source) => source.deviceId === device.id && source.enabled);
              const deviceChecks = checksByDevice.get(device.id) ?? [];
              const checkMap = new Map(deviceChecks.map((check) => [check.checkKey, check.status]));
              const commissioningState = evaluateCommissioning({ ...device, enrolled: !!device.deviceSecretHash, online: !!device.lastHeartbeatAt && evaluatedAt - device.lastHeartbeatAt.getTime() <= 2 * 60_000, commercialState: device.serviceEntitlementState, checks: deviceChecks, sources: deviceSources, publicDeviceUuid: device.publicDeviceUuid });
              const fleet = evaluateFleetState({
                ...device,
                commissioningReady: commissioningState.ready,
              }, evaluatedAt);
              const status = fleet.state.toUpperCase().replaceAll("_", " ");
              const syncState = !device.appliedConfigRevision ? "Awaiting setup"
                : device.desiredConfigRevision === device.appliedConfigRevision ? "Up to date" : "Update pending";
              const cameraCount = deviceSources.filter((source) => source.sourceType === "ip_camera").length;
              const camerasReady = checkMap?.get("cameras") === "pass";
              const audioStatus = checkMap?.get("audio") === "pass" ? "Ready" : checkMap?.get("audio") === "warning" || checkMap?.get("audio") === "fail" ? "Needs attention" : "Not checked";

              return (
                <article key={device.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{device.publicDeviceName || "Nightly Box"}</h2>
                      <p className="mt-1 text-xs text-zinc-400">Assigned to {actor.venueName}</p>
                    </div>
                    <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide ${badgeClass(status)}`}>{status}</span>
                  </div>

                  <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-zinc-500">Cameras</dt><dd className="mt-1 text-sm text-zinc-200">{cameraCount === 0 ? "Not connected" : camerasReady ? `${cameraCount} ready` : `${cameraCount} need checking`}</dd><dd className="text-xs text-zinc-400">Audio {audioStatus.toLowerCase()}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Health</dt><dd className="mt-1 text-sm text-zinc-200">{fleet.health === "healthy" ? "Ready" : fleet.health === "degraded" ? "Needs attention" : fleet.health === "offline" ? "Box offline" : "Awaiting health check"}</dd><dd className="text-xs text-zinc-400">Last check-in {device.lastHeartbeatAt?.toLocaleString() ?? "Not received"}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Hot Reels</dt><dd className="mt-1 text-sm text-zinc-200">{device.hotReelEligible && fleet.commercialState === "active" ? "Eligible" : "Unavailable"}</dd><dd className="text-xs text-zinc-400">Service {fleet.commercialState.replaceAll("_", " ")}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Software</dt><dd className="mt-1 text-sm text-zinc-200">{syncState}</dd><dd className="text-xs text-zinc-400">{fleet.connectivity === "offline" ? "Reconnect Box to check for updates" : "Checked with Nightly"}</dd></div>
                  </dl>

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Commissioning · {commissioningState.ready ? "Ready" : "In progress"}</h3>
                      <span className="text-xs text-zinc-400">{cameras.length} venue cameras</span>
                    </div>
                    <ul className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                      {commissioningState.steps.filter((step) => step.key !== "ready").map((step) => (
                        <li key={step.key} className="flex justify-between gap-3 text-xs">
                          <span className="text-zinc-300">{step.key.replaceAll("_", " ")}</span>
                          <span className="shrink-0 text-zinc-500">{step.status.toUpperCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {actor.role === "owner" || actor.role === "tech_operator" || actor.role === "manager" ? <form action={requestOwnerDeviceRecheck} className="mt-4"><input type="hidden" name="deviceId" value={device.id} /><button type="submit" className="border border-cyan-400/35 px-3 py-2 text-sm text-cyan-200">Recheck Box</button></form> : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}