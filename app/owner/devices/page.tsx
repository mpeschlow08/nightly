import { asc, eq } from "drizzle-orm";

import DeviceClaimForm from "@/components/venue-os/DeviceClaimForm";
import { db } from "@/db";
import {
  nightlyDeviceCommissioningChecks,
  nightlyDeviceSources,
  nightlyDevices,
  venueCameras,
} from "@/db/schema";
import { COMMISSIONING_CHECKS, normalizeCommissioningStatus } from "@/lib/nightly-device/policy";
import { getCurrentVenueDeviceActor } from "@/lib/nightly-device/auth";

function deviceStatus(device: typeof nightlyDevices.$inferSelect) {
  if (device.lifecycleState === "suspended" || device.serviceEntitlementState === "suspended" || device.serviceSuspendedAt) return "SUSPENDED";
  if (device.claimState !== "claimed" || device.lifecycleState === "inventory" || device.lifecycleState === "factory") return "SETUP REQUIRED";
  if (!device.lastHeartbeatAt || Date.now() - device.lastHeartbeatAt.getTime() > 120_000) return "OFFLINE";
  return "ONLINE";
}

function badgeClass(status: string) {
  if (status === "ONLINE") return "border-emerald-300/35 bg-emerald-400/10 text-emerald-200";
  if (status === "SUSPENDED") return "border-rose-300/35 bg-rose-400/10 text-rose-200";
  if (status === "SETUP REQUIRED") return "border-amber-300/35 bg-amber-400/10 text-amber-200";
  return "border-zinc-300/20 bg-white/5 text-zinc-300";
}

export default async function OwnerDevicesPage() {
  const actor = await getCurrentVenueDeviceActor();
  if (!actor) {
    return <main className="px-4 py-10 text-center text-sm text-zinc-400">Venue device access is not available for this account.</main>;
  }

  const [devices, cameras, sources, commissioning] = await Promise.all([
    db.select().from(nightlyDevices).where(eq(nightlyDevices.venueId, actor.venueId)).orderBy(asc(nightlyDevices.id)),
    db.select({ id: venueCameras.id }).from(venueCameras).where(eq(venueCameras.venueId, actor.venueId)),
    db.select().from(nightlyDeviceSources).where(eq(nightlyDeviceSources.venueId, actor.venueId)),
    db.select().from(nightlyDeviceCommissioningChecks).innerJoin(nightlyDevices, eq(nightlyDevices.id, nightlyDeviceCommissioningChecks.deviceId)).where(eq(nightlyDevices.venueId, actor.venueId)),
  ]);

  const checksByDevice = new Map<number, Map<string, string>>();
  for (const row of commissioning) {
    const checks = checksByDevice.get(row.nightly_device_commissioning_checks.deviceId) ?? new Map<string, string>();
    checks.set(row.nightly_device_commissioning_checks.checkKey, normalizeCommissioningStatus(row.nightly_device_commissioning_checks.status));
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
              const status = deviceStatus(device);
              const deviceSources = sources.filter((source) => source.deviceId === device.id && source.enabled);
              const checkMap = checksByDevice.get(device.id);
              const syncState = !device.desiredConfigRevision && !device.appliedConfigRevision
                ? "Awaiting first sync"
                : device.desiredConfigRevision === device.appliedConfigRevision ? "Synced" : "Sync pending";

              return (
                <article key={device.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{device.publicDeviceName || "Nightly Box"}</h2>
                      <p className="mt-1 text-xs text-zinc-400">Assigned to {actor.venueName} · {device.lifecycleState.replaceAll("_", " ")}</p>
                    </div>
                    <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide ${badgeClass(status)}`}>{status}</span>
                  </div>

                  <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-zinc-500">Capture</dt><dd className="mt-1 text-sm text-zinc-200">Cameras {deviceSources.filter((source) => source.sourceType === "ip_camera").length} · venue cameras {cameras.length}</dd><dd className="text-sm text-zinc-200">Mixer {deviceSources.filter((source) => source.sourceType === "mixer_audio").length} · HDMI {deviceSources.filter((source) => source.sourceType === "hdmi_input").length}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Health</dt><dd className="mt-1 text-sm text-zinc-200">{device.operationalState.replaceAll("_", " ")}</dd><dd className="text-xs text-zinc-400">Last check-in {device.lastHeartbeatAt?.toLocaleString() ?? "Not received"}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Setup and service</dt><dd className="mt-1 text-sm text-zinc-200">Claim {device.claimState.replaceAll("_", " ")}</dd><dd className="text-sm text-zinc-200">Service {device.serviceEntitlementState.replaceAll("_", " ")}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Privacy and publishing</dt><dd className="mt-1 text-sm text-zinc-200">{device.privacyMode.replaceAll("_", " ")} · {device.publicPublishingEnabled ? "Publishing eligible" : "Private"}</dd><dd className="text-xs text-zinc-400">Privacy revision {device.privacyConfigRevision}</dd></div>
                  </dl>

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Commissioning</h3>
                      <span className="text-xs text-zinc-400">Configuration: {syncState}</span>
                    </div>
                    <ul className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                      {COMMISSIONING_CHECKS.map((check) => (
                        <li key={check} className="flex justify-between gap-3 text-xs">
                          <span className="text-zinc-300">{check.replaceAll("_", " ")}</span>
                          <span className="shrink-0 text-zinc-500">{(checkMap?.get(check) ?? "not_tested").replaceAll("_", " ").toUpperCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}