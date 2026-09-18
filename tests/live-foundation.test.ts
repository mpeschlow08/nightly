import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeLivePlaybackCore,
  selectEligiblePlaybackCamera,
  type PlaybackCameraRecord,
  type PlaybackVenueRecord,
} from "@/lib/live/playback-core";
import { provisionLiveInputForCameraCore } from "@/lib/live/provisioning-core";
import { LiveProviderError, type LiveStreamProvider } from "@/lib/live/provider/types";

type MutableProvider = LiveStreamProvider & {
  calls: { create: number; get: number; health: number; auth: number };
};

function makeVenue(): PlaybackVenueRecord {
  return {
    id: 44,
    slug: "atlas",
    name: "Atlas",
    publicationStatus: "published",
    city: "Atlanta",
  };
}

function makeCamera(overrides: Partial<PlaybackCameraRecord> = {}): PlaybackCameraRecord {
  return {
    id: 7,
    name: "Main Cam",
    venueId: 44,
    status: "enabled",
    isPrimary: true,
    providerLiveInputId: "live-input-1",
    provisioningStatus: "ready",
    lastKnownStreamStatus: "connected",
    publicPlaybackEnabled: true,
    ...overrides,
  };
}

function makeProvider(overrides?: {
  isConfigured?: boolean;
  getStreamHealth?: () => Promise<{ providerStatus: string | null; isLive: boolean; activeVideoId: string | null; playbackHost: string | null }>;
  createPlaybackAuthorization?: () => Promise<{ token: string; expiresAtUnix: number }>;
  getLiveInput?: () => Promise<{ liveInputId: string; playbackId: string; playbackHlsUrl: string | null; ingestRtmpsUrl: string | null; ingestSrtUrl: string | null; ingestCredentialsIssued: boolean; providerStatus: string | null }>;
  createLiveInput?: () => Promise<{ liveInputId: string; playbackId: string; playbackHlsUrl: string | null; ingestRtmpsUrl: string | null; ingestSrtUrl: string | null; ingestCredentialsIssued: boolean; providerStatus: string | null }>;
}): MutableProvider {
  const calls = { create: 0, get: 0, health: 0, auth: 0 };

  return {
    providerKey: "mock",
    calls,
    isConfigured: () => overrides?.isConfigured ?? true,
    createLiveInput: async () => {
      calls.create += 1;
      if (overrides?.createLiveInput) {
        return overrides.createLiveInput();
      }
      return {
        liveInputId: "live-input-1",
        playbackId: "live-input-1",
        playbackHlsUrl: null,
        ingestRtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
        ingestSrtUrl: "srt://live.cloudflare.com:778",
        ingestCredentialsIssued: true,
        providerStatus: "connected",
      };
    },
    getLiveInput: async () => {
      calls.get += 1;
      if (overrides?.getLiveInput) {
        return overrides.getLiveInput();
      }
      return {
        liveInputId: "live-input-1",
        playbackId: "live-input-1",
        playbackHlsUrl: null,
        ingestRtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
        ingestSrtUrl: "srt://live.cloudflare.com:778",
        ingestCredentialsIssued: true,
        providerStatus: "connected",
      };
    },
    disableLiveInput: async () => {
      return;
    },
    getStreamHealth: async () => {
      calls.health += 1;
      if (overrides?.getStreamHealth) {
        return overrides.getStreamHealth();
      }
      return {
        providerStatus: "connected",
        isLive: true,
        activeVideoId: "video-1",
        playbackHost: "customer-test.cloudflarestream.com",
      };
    },
    createPlaybackAuthorization: async () => {
      calls.auth += 1;
      if (overrides?.createPlaybackAuthorization) {
        return overrides.createPlaybackAuthorization();
      }
      return { token: "token-abc", expiresAtUnix: Math.floor(Date.now() / 1000) + 600 };
    },
  };
}

function noOpLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function assertPlaybackPayloadSafe(payload: unknown) {
  const serialized = JSON.stringify(payload);
  const blockedFragments = [
    "streamUrl",
    "stream_url",
    "rtsp://",
    "nightlyuser",
    "SuperSecret123",
    "cf_api_token_SECRET",
    "BEGIN PRIVATE KEY",
    "srt-passphrase-123",
    "rtmps-stream-key-123",
    "provider-management-secret",
  ];

  for (const value of blockedFragments) {
    assert.equal(serialized.includes(value), false, `payload leaked forbidden fragment: ${value}`);
  }
}

test("deterministic camera selection prefers primary and supports fallback", () => {
  const first = makeCamera({ id: 1, isPrimary: false });
  const second = makeCamera({ id: 2, isPrimary: true });
  const selectedPrimary = selectEligiblePlaybackCamera([first, second], null);
  assert.equal(selectedPrimary?.id, 2);

  const noPrimary = selectEligiblePlaybackCamera([first], null);
  assert.equal(noPrimary?.id, 1);

  const explicit = selectEligiblePlaybackCamera([first, second], 1);
  assert.equal(explicit?.id, 1);
});

test("public/private playback enforcement is server-side", async () => {
  const result = await authorizeLivePlaybackCore({
    venue: makeVenue(),
    cameras: [makeCamera({ publicPlaybackEnabled: false })],
    actor: { userId: "u1", role: "consumer", city: "Atlanta" },
    provider: makeProvider(),
    logger: noOpLogger(),
    onCameraHealthObserved: async () => {},
    evaluateEntitlement: async ({ cameraPublicPlaybackEnabled }) =>
      cameraPublicPlaybackEnabled
        ? { allowed: true, reason: "allowed" }
        : { allowed: false, reason: "camera_not_public" },
  });

  assert.equal(result.status, "denied");
  assert.equal(result.reason, "camera_not_public");
  assertPlaybackPayloadSafe(result);
});

test("playback authorization denial and offline matrix", async () => {
  const base = {
    venue: makeVenue(),
    actor: { userId: "u1", role: "consumer", city: "Atlanta" },
    logger: noOpLogger(),
    onCameraHealthObserved: async () => {},
  };

  const noCamera = await authorizeLivePlaybackCore({
    ...base,
    cameras: [],
    provider: makeProvider(),
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });
  assert.equal(noCamera.reason, "no_enabled_camera");

  const unprovisioned = await authorizeLivePlaybackCore({
    ...base,
    cameras: [makeCamera({ providerLiveInputId: null })],
    provider: makeProvider(),
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });
  assert.equal(unprovisioned.reason, "camera_unprovisioned");

  const providerUnconfigured = await authorizeLivePlaybackCore({
    ...base,
    cameras: [makeCamera()],
    provider: makeProvider({ isConfigured: false }),
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });
  assert.equal(providerUnconfigured.reason, "provider_not_configured");

  const streamOffline = await authorizeLivePlaybackCore({
    ...base,
    cameras: [makeCamera({ lastKnownStreamStatus: "client_disconnect" })],
    provider: makeProvider({
      getStreamHealth: async () => ({
        providerStatus: "client_disconnect",
        isLive: false,
        activeVideoId: null,
        playbackHost: "customer-test.cloudflarestream.com",
      }),
    }),
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });
  assert.equal(streamOffline.reason, "camera_offline");
  assert.equal(streamOffline.state, "offline");

  const providerUnavailable = await authorizeLivePlaybackCore({
    ...base,
    cameras: [makeCamera()],
    provider: makeProvider({
      getStreamHealth: async () => {
        throw new LiveProviderError({ provider: "mock", code: "unavailable", message: "provider-management-secret" });
      },
    }),
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });
  assert.equal(providerUnavailable.status, "provider_unavailable");
  assert.equal(providerUnavailable.reason, "provider_unavailable");

  assertPlaybackPayloadSafe(noCamera);
  assertPlaybackPayloadSafe(unprovisioned);
  assertPlaybackPayloadSafe(providerUnconfigured);
  assertPlaybackPayloadSafe(streamOffline);
  assertPlaybackPayloadSafe(providerUnavailable);
});

test("kill switch, feature disabled, and entitlement denial responses stay safe", async () => {
  const provider = makeProvider();
  const camera = makeCamera();
  const baseInput = {
    venue: makeVenue(),
    cameras: [camera],
    actor: { userId: "u1", role: "consumer", city: "Atlanta" },
    provider,
    logger: noOpLogger(),
    onCameraHealthObserved: async () => {},
  };

  const killSwitch = await authorizeLivePlaybackCore({
    ...baseInput,
    evaluateEntitlement: async () => ({ allowed: false, reason: "kill_switch_enabled" }),
  });
  const featureDisabled = await authorizeLivePlaybackCore({
    ...baseInput,
    evaluateEntitlement: async () => ({ allowed: false, reason: "feature_disabled" }),
  });
  const denied = await authorizeLivePlaybackCore({
    ...baseInput,
    evaluateEntitlement: async () => ({ allowed: false, reason: "premium_required" }),
  });

  assert.equal(killSwitch.status, "denied");
  assert.equal(featureDisabled.status, "denied");
  assert.equal(denied.status, "denied");

  assertPlaybackPayloadSafe(killSwitch);
  assertPlaybackPayloadSafe(featureDisabled);
  assertPlaybackPayloadSafe(denied);
});

test("enabled camera is not treated as live when provider evidence is offline", async () => {
  const result = await authorizeLivePlaybackCore({
    venue: makeVenue(),
    cameras: [makeCamera({ status: "enabled", provisioningStatus: "ready" })],
    actor: { userId: null, role: null, city: "Atlanta" },
    provider: makeProvider({
      getStreamHealth: async () => ({
        providerStatus: "client_disconnect",
        isLive: false,
        activeVideoId: null,
        playbackHost: "customer-test.cloudflarestream.com",
      }),
    }),
    logger: noOpLogger(),
    onCameraHealthObserved: async () => {},
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });

  assert.equal(result.status, "offline");
  assert.equal(result.state, "offline");
  assert.equal(result.playback, null);
  assertPlaybackPayloadSafe(result);
});

test("provider-backed live evidence returns authorized playback", async () => {
  const result = await authorizeLivePlaybackCore({
    venue: makeVenue(),
    cameras: [makeCamera()],
    actor: { userId: "u1", role: "consumer", city: "Atlanta" },
    provider: makeProvider({
      getStreamHealth: async () => ({
        providerStatus: "connected",
        isLive: true,
        activeVideoId: "video-1",
        playbackHost: "customer-test.cloudflarestream.com",
      }),
      createPlaybackAuthorization: async () => ({ token: "token-abc", expiresAtUnix: 2000 }),
    }),
    logger: noOpLogger(),
    onCameraHealthObserved: async () => {},
    evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
  });

  assert.equal(result.status, "ok");
  assert.ok(result.playback?.hlsUrl.includes("/token-abc/manifest/video.m3u8"));
  assertPlaybackPayloadSafe(result);
});

test("provisioning core is idempotent and avoids duplicate provider create", async () => {
  const provider = makeProvider();
  const storeCalls = {
    pending: 0,
    ready: 0,
    readyExisting: 0,
    error: 0,
  };

  const store = {
    setProvisioningPending: async () => {
      storeCalls.pending += 1;
    },
    markReady: async () => {
      storeCalls.ready += 1;
    },
    markReadyExisting: async () => {
      storeCalls.readyExisting += 1;
    },
    markError: async () => {
      storeCalls.error += 1;
    },
  };

  const first = await provisionLiveInputForCameraCore({
    camera: {
      id: 15,
      venueId: 44,
      name: "Patio",
      status: "enabled",
      liveProvider: null,
      providerLiveInputId: null,
    },
    provider,
    store,
    now: new Date(),
  });

  const second = await provisionLiveInputForCameraCore({
    camera: {
      id: 15,
      venueId: 44,
      name: "Patio",
      status: "enabled",
      liveProvider: provider.providerKey,
      providerLiveInputId: first.liveInputId,
    },
    provider,
    store,
    now: new Date(),
  });

  assert.equal(provider.calls.create, 1);
  assert.equal(storeCalls.ready, 1);
  assert.equal(storeCalls.readyExisting, 1);
  assert.equal(second.idempotent, true);
});

test("provisioning failure does not report ready/live", async () => {
  const provider = makeProvider({
    createLiveInput: async () => {
      throw new Error("provider create failed with provider-management-secret");
    },
  });

  const storeCalls = {
    pending: 0,
    ready: 0,
    readyExisting: 0,
    error: 0,
    lastError: "",
  };

  const store = {
    setProvisioningPending: async () => {
      storeCalls.pending += 1;
    },
    markReady: async () => {
      storeCalls.ready += 1;
    },
    markReadyExisting: async () => {
      storeCalls.readyExisting += 1;
    },
    markError: async ({ message }: { cameraId: number; message: string }) => {
      storeCalls.error += 1;
      storeCalls.lastError = message;
    },
  };

  await assert.rejects(() =>
    provisionLiveInputForCameraCore({
      camera: {
        id: 18,
        venueId: 44,
        name: "Booth",
        status: "enabled",
        liveProvider: null,
        providerLiveInputId: null,
      },
      provider,
      store,
      now: new Date(),
    })
  );

  assert.equal(storeCalls.pending, 1);
  assert.equal(storeCalls.ready, 0);
  assert.equal(storeCalls.error, 1);
  assert.equal(storeCalls.lastError.includes("provider-management-secret"), true);
});
