import { createSign } from "node:crypto";

import type {
  CreateLiveInputRequest,
  LiveInputDescriptor,
  LiveProviderErrorCode,
  LiveStreamHealth,
  LiveStreamProvider,
  PlaybackAuthorization,
} from "./types";
import { LiveProviderError as ProviderError } from "./types";

const PROVIDER_KEY = "mux";
const MUX_API_BASE = "https://api.mux.com";
const MUX_PLAYBACK_HOST = "stream.mux.com";
const MUX_RTMPS_INGEST_URL = "rtmps://global-live.mux.com:443/app";

type MuxEnvelope<T> = { data: T };

type MuxPlaybackId = {
  id: string;
  policy?: "public" | "signed" | "drm";
};

type MuxLiveStream = {
  id: string;
  status?: "active" | "idle" | "disabled" | null;
  stream_key?: string;
  active_asset_id?: string | null;
  playback_ids?: MuxPlaybackId[];
};

function trimmed(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

function readApiCredentials() {
  const tokenId = trimmed(process.env.MUX_TOKEN_ID);
  const tokenSecret = trimmed(process.env.MUX_TOKEN_SECRET);

  if (!tokenId || !tokenSecret) {
    throw new ProviderError({
      provider: PROVIDER_KEY,
      code: "not_configured",
      message: "Mux API credentials are not configured.",
    });
  }

  return { tokenId, tokenSecret };
}

function readSigningKey() {
  const keyId = trimmed(process.env.MUX_SIGNING_KEY_ID);
  const rawPrivateKey = trimmed(process.env.MUX_SIGNING_KEY_PRIVATE_KEY);

  if (!keyId || !rawPrivateKey) {
    throw new ProviderError({
      provider: PROVIDER_KEY,
      code: "not_configured",
      message: "Mux signing key is not configured.",
    });
  }

  // Mux hands out the private key base64-encoded; accept a raw PEM as well.
  const privateKeyPem = rawPrivateKey.includes("-----BEGIN")
    ? rawPrivateKey
    : Buffer.from(rawPrivateKey, "base64").toString("utf8");

  return { keyId, privateKeyPem };
}

function statusToProviderError(status: number): LiveProviderErrorCode {
  if (status === 401 || status === 403) {
    return "unauthorized";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status >= 500) {
    return "unavailable";
  }
  return "request_failed";
}

async function muxJson<T>(path: string, init: RequestInit): Promise<T> {
  const { tokenId, tokenSecret } = readApiCredentials();
  const authorization = `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;

  const response = await fetch(`${MUX_API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ProviderError({
      provider: PROVIDER_KEY,
      code: statusToProviderError(response.status),
      message: `Mux API request failed with status ${response.status}`,
      statusCode: response.status,
    });
  }

  const payload = (await response.json()) as MuxEnvelope<T> | null;
  if (!payload || typeof payload.data === "undefined") {
    throw new ProviderError({
      provider: PROVIDER_KEY,
      code: "invalid_response",
      message: "Mux API returned an invalid response payload.",
      statusCode: response.status,
    });
  }

  return payload.data;
}

function selectPlaybackId(stream: MuxLiveStream) {
  const ids = stream.playback_ids ?? [];
  return ids.find((entry) => entry.policy === "signed")?.id ?? ids[0]?.id ?? null;
}

function toLiveInputDescriptor(stream: MuxLiveStream): LiveInputDescriptor {
  const playbackId = selectPlaybackId(stream);

  return {
    liveInputId: stream.id,
    playbackId: playbackId ?? stream.id,
    playbackHlsUrl: playbackId ? `https://${MUX_PLAYBACK_HOST}/${playbackId}.m3u8` : null,
    ingestRtmpsUrl: MUX_RTMPS_INGEST_URL,
    ingestSrtUrl: null,
    // Never surface the stream key itself; only whether Mux issued ingest credentials.
    ingestCredentialsIssued: Boolean(trimmed(stream.stream_key)),
    providerStatus: stream.status ?? null,
  };
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signPlaybackToken(input: {
  playbackId: string;
  expiresAtUnix: number;
  keyId: string;
  privateKeyPem: string;
}) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: input.keyId }));
  const claims = base64Url(
    JSON.stringify({ sub: input.playbackId, aud: "v", exp: input.expiresAtUnix, kid: input.keyId })
  );
  const signingInput = `${header}.${claims}`;

  try {
    const signature = createSign("RSA-SHA256").update(signingInput).sign(input.privateKeyPem);
    return `${signingInput}.${base64Url(signature)}`;
  } catch {
    throw new ProviderError({
      provider: PROVIDER_KEY,
      code: "not_configured",
      message: "Mux signing key could not be used to sign a playback token.",
    });
  }
}

export class MuxLiveStreamProvider implements LiveStreamProvider {
  readonly providerKey = PROVIDER_KEY;

  isConfigured() {
    return Boolean(
      trimmed(process.env.MUX_TOKEN_ID) &&
        trimmed(process.env.MUX_TOKEN_SECRET) &&
        trimmed(process.env.MUX_SIGNING_KEY_ID) &&
        trimmed(process.env.MUX_SIGNING_KEY_PRIVATE_KEY)
    );
  }

  async createLiveInput(input: CreateLiveInputRequest): Promise<LiveInputDescriptor> {
    const stream = await muxJson<MuxLiveStream>("/video/v1/live-streams", {
      method: "POST",
      body: JSON.stringify({
        playback_policies: ["signed"],
        new_asset_settings: { playback_policies: ["signed"] },
        reconnect_window: 60,
        // Mux has no idempotency header; the key is stored as passthrough so a
        // Nightly-managed stream can always be traced back to one camera.
        passthrough: input.idempotencyKey,
        meta: { title: input.label },
      }),
    });

    return toLiveInputDescriptor(stream);
  }

  async getLiveInput(liveInputId: string): Promise<LiveInputDescriptor> {
    const stream = await muxJson<MuxLiveStream>(`/video/v1/live-streams/${encodeURIComponent(liveInputId)}`, {
      method: "GET",
    });

    return toLiveInputDescriptor(stream);
  }

  async disableLiveInput(liveInputId: string): Promise<void> {
    await muxJson<unknown>(`/video/v1/live-streams/${encodeURIComponent(liveInputId)}/disable`, {
      method: "PUT",
    });
  }

  async getStreamHealth(liveInputId: string): Promise<LiveStreamHealth> {
    const stream = await muxJson<MuxLiveStream>(`/video/v1/live-streams/${encodeURIComponent(liveInputId)}`, {
      method: "GET",
    });

    const status = stream.status ?? null;
    // Mux only reports "active" while an encoder is actually ingesting.
    const isLive = status === "active";
    const playbackId = selectPlaybackId(stream);

    return {
      providerStatus: status,
      isLive,
      activeVideoId: isLive ? playbackId : null,
      playbackHost: MUX_PLAYBACK_HOST,
    };
  }

  async createPlaybackAuthorization(videoId: string, expiresAtUnix: number): Promise<PlaybackAuthorization> {
    const { keyId, privateKeyPem } = readSigningKey();
    const token = signPlaybackToken({ playbackId: videoId, expiresAtUnix, keyId, privateKeyPem });

    return {
      token,
      expiresAtUnix,
      hlsUrl: `https://${MUX_PLAYBACK_HOST}/${videoId}.m3u8?token=${encodeURIComponent(token)}`,
    };
  }
}
