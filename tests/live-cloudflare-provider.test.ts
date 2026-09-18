import assert from "node:assert/strict";
import test from "node:test";

import { CloudflareLiveStreamProvider } from "@/lib/live/provider/cloudflare-stream";
import { LiveProviderError } from "@/lib/live/provider/types";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function withCloudflareEnv(fn: () => Promise<void> | void) {
  const originalAccount = process.env.CLOUDFLARE_STREAM_ACCOUNT_ID;
  const originalToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  process.env.CLOUDFLARE_STREAM_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_STREAM_API_TOKEN = "cf_api_token_SECRET";

  try {
    return fn();
  } finally {
    process.env.CLOUDFLARE_STREAM_ACCOUNT_ID = originalAccount;
    process.env.CLOUDFLARE_STREAM_API_TOKEN = originalToken;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("cloudflare provider create/get/update token flow uses official endpoints", async () => {
  await withCloudflareEnv(async () => {
    const calls: FetchCall[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      const url = String(input);

      if (url.includes("/stream/live_inputs") && init?.method === "POST") {
        return jsonResponse({
          success: true,
          result: {
            uid: "live-input-1",
            status: "connected",
            playback: { hls: "https://customer-test.cloudflarestream.com/live-input-1/manifest/video.m3u8" },
            rtmps: { url: "rtmps://live.cloudflare.com:443/live/", streamKey: "rtmps-stream-key-123" },
            srt: { url: "srt://live.cloudflare.com:778", passphrase: "srt-passphrase-123" },
          },
        });
      }

      if (url.endsWith("/stream/live_inputs/live-input-1") && init?.method === "GET") {
        return jsonResponse({
          success: true,
          result: {
            uid: "live-input-1",
            status: "connected",
            playback: { hls: "https://customer-test.cloudflarestream.com/live-input-1/manifest/video.m3u8" },
          },
        });
      }

      if (url.endsWith("/stream/live_inputs/live-input-1") && init?.method === "PUT") {
        return jsonResponse({ success: true, result: { uid: "live-input-1", enabled: false } });
      }

      if (url.endsWith("/stream/video-1/token") && init?.method === "POST") {
        return jsonResponse({ success: true, result: { token: "token-abc" } });
      }

      if (url === "https://customer-test.cloudflarestream.com/live-input-1/lifecycle") {
        return jsonResponse({ live: true, videoUID: "video-1" });
      }

      throw new Error(`Unexpected URL in test: ${url}`);
    }) as typeof fetch;

    try {
      const provider = new CloudflareLiveStreamProvider();
      const created = await provider.createLiveInput({
        idempotencyKey: "idem-key-1",
        label: "Main Camera",
        venueId: 1,
        cameraId: 10,
      });
      assert.equal(created.liveInputId, "live-input-1");
      assert.equal(created.ingestCredentialsIssued, true);

      const input = await provider.getLiveInput("live-input-1");
      assert.equal(input.providerStatus, "connected");

      const health = await provider.getStreamHealth("live-input-1");
      assert.equal(health.isLive, true);
      assert.equal(health.activeVideoId, "video-1");
      assert.equal(health.playbackHost, "customer-test.cloudflarestream.com");

      const auth = await provider.createPlaybackAuthorization("video-1", 2000);
      assert.equal(auth.token, "token-abc");

      await provider.disableLiveInput("live-input-1");

      const createCall = calls.find((call) => String(call.input).endsWith("/stream/live_inputs") && call.init?.method === "POST");
      assert.ok(createCall);
      assert.equal((createCall?.init?.headers as Record<string, string>)["Idempotency-Key"], "idem-key-1");

      const createBody = JSON.parse(String(createCall?.init?.body));
      assert.equal(createBody.recording.requireSignedURLs, true);

      const tokenCall = calls.find((call) => String(call.input).endsWith("/stream/video-1/token"));
      assert.ok(tokenCall);
      const tokenBody = JSON.parse(String(tokenCall?.init?.body));
      assert.equal(tokenBody.exp, 2000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("cloudflare provider normalizes HTTP/provider errors", async () => {
  await withCloudflareEnv(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return jsonResponse({ success: false, errors: [{ code: 10000, message: "provider-management-secret" }] }, 429);
    }) as typeof fetch;

    try {
      const provider = new CloudflareLiveStreamProvider();
      await assert.rejects(
        () => provider.getLiveInput("missing"),
        (error: unknown) => {
          assert.ok(error instanceof LiveProviderError);
          assert.equal((error as LiveProviderError).code, "rate_limited");
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
