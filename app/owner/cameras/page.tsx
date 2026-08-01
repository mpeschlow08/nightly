import { notFound } from "next/navigation";

import {
  addOwnerCameraAction,
  deleteOwnerCameraAction,
  renameOwnerCameraAction,
  setPrimaryOwnerCameraAction,
  toggleOwnerCameraStatusAction,
} from "../actions";
import { getOwnerCameras } from "../lib/data";
import { getCurrentOwnerVenue } from "../lib/ownership";
import EmptyStateCard from "@/components/EmptyStateCard";
import { isFeatureEnabled } from "@/lib/platform/feature-access";

type OwnerCamerasPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function formatStreamType(type: string) {
  return type.toUpperCase();
}

export default async function OwnerCamerasPage({ searchParams }: OwnerCamerasPageProps) {
  const [owner, cameraState, params, liveCamerasEnabled] = await Promise.all([
    getCurrentOwnerVenue(),
    getOwnerCameras(),
    searchParams,
    getCurrentOwnerVenue().then((currentOwner) =>
      isFeatureEnabled("feature.live_cameras", {
        environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
        userId: currentOwner.clerkUserId,
        venueId: currentOwner.venueId,
        role: currentOwner.role,
        city: currentOwner.venue.city ?? undefined,
      })
    ),
  ]);

  if (!owner.venue) {
    notFound();
  }

  if (!liveCamerasEnabled) {
    return (
      <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Live Cameras</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Unavailable in Beta V1</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Live camera management is deferred until the post-beta VenueOS and camera rollout.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Live Cameras</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{owner.venue.name} Camera Management</h2>
      <p className="mt-2 text-sm text-zinc-300">Manage stream sources for the Nightly Live camera experience.</p>

      {params.success ? (
        <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {params.success}
        </div>
      ) : null}
      {params.error ? (
        <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {params.error}
        </div>
      ) : null}

      {cameraState.unavailable ? (
        <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Camera table is unavailable in this environment. Run the latest migration before managing cameras.
        </div>
      ) : null}

      <form action={addOwnerCameraAction} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <input type="hidden" name="venueId" value={owner.venueId} />
        <h3 className="text-sm font-semibold text-white">Add camera</h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="owner-camera-name" className="text-sm font-medium text-zinc-200">
              Camera name
            </label>
            <input
              id="owner-camera-name"
              name="name"
              required
              placeholder="Front Entrance"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label htmlFor="owner-camera-stream-type" className="text-sm font-medium text-zinc-200">
              Stream type
            </label>
            <select
              id="owner-camera-stream-type"
              name="streamType"
              defaultValue="hls"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="hls">HLS</option>
              <option value="rtsp">RTSP</option>
              <option value="webrtc">WebRTC</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="owner-camera-stream-url" className="text-sm font-medium text-zinc-200">
              Stream URL
            </label>
            <input
              id="owner-camera-stream-url"
              name="streamUrl"
              required
              placeholder="https://example.com/live/playlist.m3u8"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-zinc-100">
              <input type="checkbox" name="isEnabled" defaultChecked className="h-4 w-4 accent-cyan-500" />
              Enabled on create
            </label>
          </div>
        </div>

        <button type="submit" className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
          Add camera
        </button>
      </form>

      {cameraState.cameras.length === 0 ? (
        <EmptyStateCard
          className="mt-6"
          icon="events"
          eyebrow="No Cameras"
          title="No camera sources configured"
          description="Add your first camera feed to start managing Nightly Live coverage for your venue."
          note="Supported stream types are HLS, RTSP, WebRTC, or Other."
        />
      ) : (
        <div className="mt-6 grid gap-4">
          {cameraState.cameras.map((camera) => {
            const statusLabel = camera.status === "enabled" ? "Enabled" : "Disabled";
            const nextStatus = camera.status === "enabled" ? "disabled" : "enabled";

            return (
              <article key={camera.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-zinc-300">
                    {formatStreamType(camera.streamType)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${
                      camera.status === "enabled"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                        : "border-amber-400/40 bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  {camera.isPrimary ? (
                    <span className="rounded-full border border-cyan-300/50 bg-cyan-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                      Primary
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 break-all text-sm text-zinc-300">{camera.streamUrl}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <form action={renameOwnerCameraAction} className="flex flex-col gap-2">
                    <input type="hidden" name="cameraId" value={camera.id} />
                    <label htmlFor={`camera-name-${camera.id}`} className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                      Camera Name
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id={`camera-name-${camera.id}`}
                        name="name"
                        defaultValue={camera.name}
                        required
                        className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                      />
                      <button type="submit" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-zinc-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
                        Rename
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    <form action={setPrimaryOwnerCameraAction}>
                      <input type="hidden" name="cameraId" value={camera.id} />
                      <button
                        type="submit"
                        disabled={camera.isPrimary}
                        className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {camera.isPrimary ? "Primary" : "Set Primary"}
                      </button>
                    </form>

                    <form action={toggleOwnerCameraStatusAction}>
                      <input type="hidden" name="cameraId" value={camera.id} />
                      <input type="hidden" name="status" value={nextStatus} />
                      <button
                        type="submit"
                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-zinc-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                      >
                        {camera.status === "enabled" ? "Disable" : "Enable"}
                      </button>
                    </form>

                    <form action={deleteOwnerCameraAction}>
                      <input type="hidden" name="cameraId" value={camera.id} />
                      <button type="submit" className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
