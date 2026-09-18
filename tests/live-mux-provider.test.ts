import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { authorizeLivePlaybackCore, type PlaybackCameraRecord, type PlaybackVenueRecord } from "@/lib/live/playback-core";
import { resolveLiveProviderKey } from "@/lib/live/config";
import { CloudflareLiveStreamProvider } from "@/lib/live/provider/cloudflare-stream";
import { MuxLiveStreamProvider } from "@/lib/live/provider/mux";
import { LiveProviderError } from "@/lib/live/provider/types";
import { provisionLiveInputForCameraCore } from "@/lib/live/provisioning-core";
import { mapNightlyStreamState } from "@/lib/live/stream-state";

const MUX_ENV_KEYS = [
  "CAMERA_LIVE_PROVIDER",
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "MUX_SIGNING_KEY_ID",
  "MUX_SIGNING_KEY_PRIVATE_KEY",
] as const;

const signingKeyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const TEST_PRIVATE_KEY_BASE64 = Buffer.from(signingKeyPair.privateKey).toString("base64");

async function withMuxEnv(overrides: Partial<Record<(typeof MUX_ENV_KEYS)[number], string | undefined>>, fn: () => Promise<void> | void) {
  const original = Object.fromEntries(MUX_ENV_KEYS.map((key) => [key, process.env[key]]));

  const defaults: Record<string, string> = {
    CAMERA_LIVE_PROVIDER: "mux",
    MUX_TOKEN_ID: "mux-token-id-SECRET",
    MUX_TOKEN_SECRET: "mux-token-secret-SECRET",
    MUX_SIGNING_KEY_ID: "signing-key-id",
    MUX_SIGNING_KEY_PRIVATE_KEY: TEST_PRIVATE_KEY_BASE64,
  };

  for (const key of MUX_ENV_KEYS) {
    const value = key in overrides ? overrides[key] : defaults[key];
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const key of MUX_ENV_KEYS) {
      const value = original[key];
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function liveStreamPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "mux-live-stream-1",
    status: "idle",
    stream_key: "mux-stream-key-SECRET",
    playback_ids: [{ id: "mux-playback-id-1", policy: "signed" }],
    ...overrides,
  };
}

async function withFetch(handler: (url: string, init?: RequestInit) => Response, fn: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertNoProviderSecrets(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const fragment of [
    "mux-token-id-SECRET",
    "mux-token-secret-SECRET",
    "mux-stream-key-SECRET",
    "BEGIN PRIVATE KEY",
    "rtmps://",
    "srt://",
    "rtsp://",
    "streamKey",
    "stream_key",
    "passphrase",
  ]) {
    assert.equal(serialized.includes(fragment), false, `payload leaked forbidden fragment: ${fragment}`);
  }
}

function makeVenue(): PlaybackVenueRecord {
  return { id: 44, slug: "atlas", name: "Atlas", publicationStatus: "published", city: "Atlanta" };
}

function makeCamera(overrides: Partial<PlaybackCameraRecord> = {}): PlaybackCameraRecord {
  return {
    id: 7,
    name: "Main Cam",
    venueId: 44,
    status: "enabled",
    isPrimary: true,
    providerLiveInputId: "mux-live-stream-1",
    provisioningStatus: "ready",
    lastKnownStreamStatus: "idle",
    publicPlaybackEnabled: true,
    ...overrides,
  };
}

const noOpLogger = { info: () => {}, warn: () => {}, error: () => {} };

test("provider selection honours CAMERA_LIVE_PROVIDER", async () => {
  await withMuxEnv({}, () => {
    assert.equal(resolveLiveProviderKey(), "mux");
  });

  await withMuxEnv({ CAMERA_LIVE_PROVIDER: "cloudflare" }, () => {
    assert.equal(resolveLiveProviderKey(), "cloudflare_stream");
  });

  await withMuxEnv({ CAMERA_LIVE_PROVIDER: "mux_video" }, () => {
    assert.equal(resolveLiveProviderKey(), "mux");
  });

  await withMuxEnv({ CAMERA_LIVE_PROVIDER: "unknown" }, () => {
    assert.equal(resolveLiveProviderKey(), "mock");
  });

  // Cloudflare regression: the existing adapter keeps its own provider key.
  assert.equal(new CloudflareLiveStreamProvider().providerKey, "cloudflare_stream");
  assert.equal(new MuxLiveStreamProvider().providerKey, "mux");
});

test("mux provider reports unconfigured until all server credentials exist", async () => {
  await withMuxEnv({ MUX_TOKEN_ID: undefined }, () => {
    assert.equal(new MuxLiveStreamProvider().isConfigured(), false);
  });

  await withMuxEnv({ MUX_SIGNING_KEY_ID: undefined }, () => {
    assert.equal(new MuxLiveStreamProvider().isConfigured(), false);
  });

  await withMuxEnv({}, () => {
    assert.equal(new MuxLiveStreamProvider().isConfigured(), true);
  });
});

test("mux create/get maps to the provider-neutral descriptor without leaking secrets", async () => {
  await withMuxEnv({}, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetch(
      (url, init) => {
        calls.push({ url, init });
        if (url.endsWith("/video/v1/live-streams") && init?.method === "POST") {
          return jsonResponse({ data: liveStreamPayload() });
        }
        if (url.endsWith("/video/v1/live-streams/mux-live-stream-1") && init?.method === "GET") {
          return jsonResponse({ data: liveStreamPayload() });
        }
        throw new Error(`Unexpected URL in test: ${url}`);
      },
      async () => {
        const provider = new MuxLiveStreamProvider();
        const created = await provider.createLiveInput({
          idempotencyKey: "nightly-live-camera-7",
          label: "Main Cam (44:7)",
          venueId: 44,
          cameraId: 7,
        });

        assert.equal(created.liveInputId, "mux-live-stream-1");
        assert.equal(created.playbackId, "mux-playback-id-1");
        assert.equal(created.providerStatus, "idle");
        assert.equal(created.ingestCredentialsIssued, true);
        assert.equal(JSON.stringify(created).includes("mux-stream-key-SECRET"), false);

        const createCall = calls.find((call) => call.init?.method === "POST");
        const body = JSON.parse(String(createCall?.init?.body));
        assert.deepEqual(body.playback_policies, ["signed"]);
        assert.equal(body.passthrough, "nightly-live-camera-7");
        assert.ok(String((createCall?.init?.headers as Record<string, string>).authorization).startsWith("Basic "));

        const fetched = await provider.getLiveInput("mux-live-stream-1");
        assert.equal(fetched.playbackId, "mux-playback-id-1");
      }
    );
  });
});

test("mux idle is never live and active maps to live", async () => {
  await withMuxEnv({}, async () => {
    await withFetch(
      () => jsonResponse({ data: liveStreamPayload({ status: "idle" }) }),
      async () => {
        const health = await new MuxLiveStreamProvider().getStreamHealth("mux-live-stream-1");
        assert.equal(health.isLive, false);
        assert.equal(health.activeVideoId, null);
        assert.equal(
          mapNightlyStreamState({
            cameraEnabled: true,
            provisioningStatus: "ready",
            providerStatus: health.providerStatus,
            lifecycleLive: health.isLive,
          }),
          "offline"
        );
      }
    );

    await withFetch(
      () => jsonResponse({ data: liveStreamPayload({ status: "active", active_asset_id: "mux-asset-1" }) }),
      async () => {
        const health = await new MuxLiveStreamProvider().getStreamHealth("mux-live-stream-1");
        assert.equal(health.isLive, true);
        assert.equal(health.activeVideoId, "mux-playback-id-1");
        assert.equal(health.playbackHost, "stream.mux.com");
        assert.equal(
          mapNightlyStreamState({
            cameraEnabled: true,
            provisioningStatus: "ready",
            providerStatus: health.providerStatus,
            lifecycleLive: health.isLive,
          }),
          "live"
        );
      }
    );

    await withFetch(
      () => jsonResponse({ data: liveStreamPayload({ status: "disabled" }) }),
      async () => {
        const health = await new MuxLiveStreamProvider().getStreamHealth("mux-live-stream-1");
        assert.equal(health.isLive, false);
      }
    );
  });
});

test("mux normalizes provider errors", async () => {
  await withMuxEnv({}, async () => {
    await withFetch(
      () => jsonResponse({ error: {} }, 401),
      async () => {
        await assert.rejects(
          () => new MuxLiveStreamProvider().getLiveInput("mux-live-stream-1"),
          (error: unknown) => {
            assert.ok(error instanceof LiveProviderError);
            assert.equal((error as LiveProviderError).code, "unauthorized");
            assert.equal((error as LiveProviderError).message.includes("mux-token-secret-SECRET"), false);
            return true;
          }
        );
      }
    );

    await withFetch(
      () => jsonResponse({ data: liveStreamPayload() }, 503),
      async () => {
        await assert.rejects(
          () => new MuxLiveStreamProvider().getStreamHealth("mux-live-stream-1"),
          (error: unknown) => (error as LiveProviderError).code === "unavailable"
        );
      }
    );

    await withFetch(
      () => jsonResponse({ nope: true }),
      async () => {
        await assert.rejects(
          () => new MuxLiveStreamProvider().getLiveInput("mux-live-stream-1"),
          (error: unknown) => (error as LiveProviderError).code === "invalid_response"
        );
      }
    );
  });

  await withMuxEnv({ MUX_TOKEN_SECRET: undefined }, async () => {
    await assert.rejects(
      () => new MuxLiveStreamProvider().getLiveInput("mux-live-stream-1"),
      (error: unknown) => (error as LiveProviderError).code === "not_configured"
    );
  });
});

test("mux playback authorization returns a signed short-lived HLS url", async () => {
  await withMuxEnv({}, async () => {
    const authorization = await new MuxLiveStreamProvider().createPlaybackAuthorization("mux-playback-id-1", 2000);

    assert.equal(authorization.expiresAtUnix, 2000);
    assert.ok(authorization.hlsUrl?.startsWith("https://stream.mux.com/mux-playback-id-1.m3u8?token="));

    const [header, claims] = authorization.token.split(".");
    const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    const decodedClaims = JSON.parse(Buffer.from(claims, "base64url").toString("utf8"));

    assert.equal(decodedHeader.alg, "RS256");
    assert.equal(decodedHeader.kid, "signing-key-id");
    assert.equal(decodedClaims.sub, "mux-playback-id-1");
    assert.equal(decodedClaims.aud, "v");
    assert.equal(decodedClaims.exp, 2000);
    assert.equal(authorization.token.includes("BEGIN PRIVATE KEY"), false);
  });

  await withMuxEnv({ MUX_SIGNING_KEY_PRIVATE_KEY: undefined }, async () => {
    await assert.rejects(
      () => new MuxLiveStreamProvider().createPlaybackAuthorization("mux-playback-id-1", 2000),
      (error: unknown) => (error as LiveProviderError).code === "not_configured"
    );
  });
});

test("mux playback authorization flows through nightly entitlement gates", async () => {
  await withMuxEnv({}, async () => {
    const provider = new MuxLiveStreamProvider();
    const base = {
      venue: makeVenue(),
      actor: { userId: "u1", role: "consumer", city: "Atlanta" },
      provider,
      logger: noOpLogger,
      onCameraHealthObserved: async () => {},
    };

    await withFetch(
      () => jsonResponse({ data: liveStreamPayload({ status: "active", active_asset_id: "mux-asset-1" }) }),
      async () => {
        const authorized = await authorizeLivePlaybackCore({
          ...base,
          cameras: [makeCamera()],
          evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
        });
        assert.equal(authorized.status, "ok");
        assert.equal(authorized.state, "live");
        assert.ok(authorized.playback?.hlsUrl.startsWith("https://stream.mux.com/mux-playback-id-1.m3u8?token="));
        assertNoProviderSecrets(authorized);

        const privateCamera = await authorizeLivePlaybackCore({
          ...base,
          cameras: [makeCamera({ publicPlaybackEnabled: false })],
          evaluateEntitlement: async ({ cameraPublicPlaybackEnabled }) =>
            cameraPublicPlaybackEnabled
              ? { allowed: true, reason: "allowed" }
              : { allowed: false, reason: "camera_not_public" },
        });
        assert.equal(privateCamera.status, "denied");
        assert.equal(privateCamera.reason, "camera_not_public");
        assert.equal(privateCamera.playback, null);
        assertNoProviderSecrets(privateCamera);

        const killSwitch = await authorizeLivePlaybackCore({
          ...base,
          cameras: [makeCamera()],
          evaluateEntitlement: async () => ({ allowed: false, reason: "kill_switch_enabled" }),
        });
        assert.equal(killSwitch.status, "denied");
        assert.equal(killSwitch.playback, null);

        const featureDisabled = await authorizeLivePlaybackCore({
          ...base,
          cameras: [makeCamera()],
          evaluateEntitlement: async () => ({ allowed: false, reason: "feature_disabled" }),
        });
        assert.equal(featureDisabled.status, "denied");
        assert.equal(featureDisabled.playback, null);
      }
    );

    await withFetch(
      () => jsonResponse({ data: liveStreamPayload({ status: "idle" }) }),
      async () => {
        const offline = await authorizeLivePlaybackCore({
          ...base,
          cameras: [makeCamera()],
          evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
        });
        assert.equal(offline.status, "offline");
        assert.equal(offline.state, "offline");
        assert.equal(offline.playback, null);
        assertNoProviderSecrets(offline);
      }
    );

    await withFetch(
      () => jsonResponse({ error: {} }, 500),
      async () => {
        const failed = await authorizeLivePlaybackCore({
          ...base,
          cameras: [makeCamera()],
          evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
        });
        assert.equal(failed.status, "provider_unavailable");
        assert.equal(failed.reason, "provider_unavailable");
        assert.equal(failed.playback, null);
        assertNoProviderSecrets(failed);
      }
    );
  });

  await withMuxEnv({ MUX_TOKEN_ID: undefined }, async () => {
    const unconfigured = await authorizeLivePlaybackCore({
      venue: makeVenue(),
      cameras: [makeCamera()],
      actor: { userId: "u1", role: "consumer", city: "Atlanta" },
      provider: new MuxLiveStreamProvider(),
      logger: noOpLogger,
      onCameraHealthObserved: async () => {},
      evaluateEntitlement: async () => ({ allowed: true, reason: "allowed" }),
    });

    assert.equal(unconfigured.status, "provider_unavailable");
    assert.equal(unconfigured.reason, "provider_not_configured");
  });
});

test("mux provisioning is idempotent and never persists ingest secrets", async () => {
  await withMuxEnv({}, async () => {
    const provider = new MuxLiveStreamProvider();
    const calls = { create: 0, get: 0 };
    const storeCalls = { pending: 0, ready: 0, readyExisting: 0, error: 0 };
    const persisted: unknown[] = [];

    const store = {
      setProvisioningPending: async () => {
        storeCalls.pending += 1;
      },
      markReady: async (input: unknown) => {
        storeCalls.ready += 1;
        persisted.push(input);
      },
      markReadyExisting: async (input: unknown) => {
        storeCalls.readyExisting += 1;
        persisted.push(input);
      },
      markError: async () => {
        storeCalls.error += 1;
      },
    };

    await withFetch(
      (url, init) => {
        if (init?.method === "POST") {
          calls.create += 1;
          return jsonResponse({ data: liveStreamPayload() });
        }
        calls.get += 1;
        return jsonResponse({ data: liveStreamPayload() });
      },
      async () => {
        const first = await provisionLiveInputForCameraCore({
          camera: { id: 7, venueId: 44, name: "Main Cam", status: "enabled", liveProvider: null, providerLiveInputId: null },
          provider,
          store,
          now: new Date(),
        });

        const second = await provisionLiveInputForCameraCore({
          camera: {
            id: 7,
            venueId: 44,
            name: "Main Cam",
            status: "enabled",
            liveProvider: "mux",
            providerLiveInputId: first.liveInputId,
          },
          provider,
          store,
          now: new Date(),
        });

        assert.equal(calls.create, 1);
        assert.equal(second.idempotent, true);
        assert.equal(first.provisioningStatus, "ready");
        // An enabled, provisioned camera with an idle Mux stream is not live.
        assert.equal(first.streamState, "offline");
        assert.equal(storeCalls.error, 0);

        for (const record of persisted) {
          assert.equal(JSON.stringify(record).includes("mux-stream-key-SECRET"), false);
        }
      }
    );
  });
});

test("mux provisioning failure marks error and never reports ready", async () => {
  await withMuxEnv({}, async () => {
    const storeCalls = { pending: 0, ready: 0, readyExisting: 0, error: 0 };

    await withFetch(
      () => jsonResponse({ error: {} }, 429),
      async () => {
        await assert.rejects(() =>
          provisionLiveInputForCameraCore({
            camera: { id: 7, venueId: 44, name: "Main Cam", status: "enabled", liveProvider: null, providerLiveInputId: null },
            provider: new MuxLiveStreamProvider(),
            store: {
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
            },
            now: new Date(),
          })
        );

        assert.equal(storeCalls.ready, 0);
        assert.equal(storeCalls.error, 1);
      }
    );
  });
});
