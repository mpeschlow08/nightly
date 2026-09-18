"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type PlaybackState = "provisioning" | "ready" | "live" | "offline" | "error" | "disabled";

type PlaybackResponse = {
  status: "ok" | "denied" | "offline" | "error" | "provider_unavailable";
  reason: string;
  state: PlaybackState;
  venue: { id: number; slug: string; name: string } | null;
  camera: { id: number; name: string } | null;
  playback: null | {
    protocol: "hls";
    hlsUrl: string;
    expiresAtIso: string;
  };
};

type Props = {
  venueSlugOrId: string;
  venueName: string;
  venueHref: string;
};

const OFFLINE_RETRY_INTERVAL_MS = 20_000;
const MAX_OFFLINE_RETRIES = 9;

function stateLabel(value: PlaybackState) {
  return value.replace(/_/g, " ").toUpperCase();
}

function statusCopy(response: PlaybackResponse | null) {
  if (!response) {
    return "Connecting to live stream authorization...";
  }

  if (response.status === "ok") {
    return "Authorized live playback is active.";
  }

  if (response.status === "denied") {
    if (response.reason === "camera_not_public") {
      return "This camera is private right now.";
    }
    if (response.reason === "feature_disabled") {
      return "Live camera playback is currently disabled.";
    }
    if (response.reason === "premium_required") {
      return "This live stream requires premium access.";
    }
    return "Access to this live stream is currently denied.";
  }

  if (response.status === "provider_unavailable") {
    return "Live stream provider is unavailable. Please try again shortly.";
  }

  return "Stream is offline right now. We will keep checking.";
}

export default function LiveVenueStreamClient({ venueSlugOrId, venueName, venueHref }: Props) {
  const [response, setResponse] = useState<PlaybackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryExhausted, setRetryExhausted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let offlineRetries = 0;

    async function run() {
      if (!cancelled) {
        setLoading(true);
      }

      try {
        const result = await fetch(`/api/live/playback?venue=${encodeURIComponent(venueSlugOrId)}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await result.json()) as PlaybackResponse;
        if (cancelled) {
          return;
        }
        setResponse(payload);
        setLoading(false);
        setRetryExhausted(false);

        if (payload.status === "ok" && payload.playback?.expiresAtIso) {
          offlineRetries = 0;
          const refreshAt = new Date(payload.playback.expiresAtIso).getTime() - 15_000;
          const delay = Math.max(5_000, refreshAt - Date.now());
          timer = setTimeout(() => {
            void run();
          }, delay);
          return;
        }

        offlineRetries += 1;
        if (offlineRetries > MAX_OFFLINE_RETRIES) {
          setRetryExhausted(true);
          return;
        }

        timer = setTimeout(() => {
          void run();
        }, OFFLINE_RETRY_INTERVAL_MS);
      } catch {
        if (cancelled) {
          return;
        }
        setResponse({
          status: "error",
          reason: "network_error",
          state: "error",
          venue: null,
          camera: null,
          playback: null,
        });
        setLoading(false);

        offlineRetries += 1;
        if (offlineRetries > MAX_OFFLINE_RETRIES) {
          setRetryExhausted(true);
          return;
        }

        timer = setTimeout(() => {
          void run();
        }, OFFLINE_RETRY_INTERVAL_MS);
      }
    }

    void run();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [venueSlugOrId]);

  const headerVenueName = response?.venue?.name ?? venueName;
  const streamState = response?.state ?? "offline";
  const canPlay = response?.status === "ok" && Boolean(response.playback?.hlsUrl);
  const playbackHlsUrl = response?.playback?.hlsUrl ?? null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canPlay || !playbackHlsUrl) {
      return;
    }

    let hls: Hls | null = null;
    const canUseNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    // Chromium reports "maybe" for HLS without real support, so prefer MSE and keep native as fallback.
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(playbackHlsUrl);
      hls.attachMedia(video);
    } else if (canUseNativeHls) {
      video.src = playbackHlsUrl;
    } else {
      video.src = playbackHlsUrl;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }

      video.removeAttribute("src");
      video.load();
    };
  }, [canPlay, playbackHlsUrl]);

  const expiresAtIso = response?.playback?.expiresAtIso ?? null;
  const expiresAtLabel = expiresAtIso
    ? new Date(expiresAtIso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // Provider truth can still be "live" while entitlement denies playback; never badge that as LIVE.
  const badgeLabel = response && response.status !== "ok" && streamState === "live" ? "UNAVAILABLE" : stateLabel(streamState);

  return (
    <section className="mx-auto w-full max-w-4xl rounded-[1.7rem] border border-white/10 bg-zinc-950/80 p-5 text-zinc-100 shadow-[0_0_70px_rgba(56,189,248,0.15)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/85">Nightly Live Playback</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{headerVenueName}</h1>
          <p className="mt-2 text-sm text-zinc-300">{statusCopy(response)}</p>
        </div>
        <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">
          {badgeLabel}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        {loading ? (
          <div className="grid h-[16rem] place-items-center text-sm text-zinc-300">Requesting secure playback...</div>
        ) : canPlay ? (
          <video
            ref={videoRef}
            className="h-[16rem] w-full bg-black object-cover sm:h-[23rem]"
            controls
            muted
            playsInline
          />
        ) : (
          <div className="grid h-[16rem] place-items-center px-6 text-center text-sm text-zinc-300 sm:h-[23rem]">
            <div>
              <p className="text-base font-medium text-zinc-100">Live video unavailable</p>
              <p className="mt-2">Provisioning, entitlement, or provider status is preventing playback.</p>
              {retryExhausted ? <p className="mt-2 text-zinc-400">Automatic retries paused to avoid aggressive polling. Refresh to try again.</p> : null}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          Camera: {response?.camera?.name ?? "Not selected"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reason: {response?.reason ?? "loading"}</span>
        {expiresAtLabel ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Token refresh: {expiresAtLabel}</span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/live"
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-zinc-100 transition hover:border-cyan-300/45 hover:bg-cyan-500/10"
        >
          Back to Live Feed
        </Link>
        <Link
          href={venueHref}
          className="rounded-full border border-violet-300/35 bg-violet-500/12 px-4 py-2 text-sm text-violet-100 transition hover:border-violet-200/50"
        >
          Venue Details
        </Link>
      </div>
    </section>
  );
}
