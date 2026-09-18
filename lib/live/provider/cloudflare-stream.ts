
import type {
  CreateLiveInputRequest,
  LiveInputDescriptor,
  LiveProviderErrorCode,
  LiveStreamHealth,
  LiveStreamProvider,
  PlaybackAuthorization,
} from "./types";
import { LiveProviderError as ProviderError } from "./types";

type CloudflareApiResponse<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
};

type CloudflareLiveInput = {
  uid: string;
  enabled?: boolean;
  status?: string | null;
  playback?: {
    hls?: string;
  };
  rtmps?: {
    url?: string;
    streamKey?: string;
  };
  srt?: {
    url?: string;
    passphrase?: string;
  };
};

type CloudflareLifecycle = {
  isInput?: boolean;
  videoUID?: string | null;
  live?: boolean;
};

function configured(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function assertConfigured() {
  const accountId = process.env.CLOUDFLARE_STREAM_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();

  if (!configured(accountId) || !configured(token)) {
    throw new ProviderError({
      provider: "cloudflare_stream",
      code: "not_configured",
      message: "Cloudflare Stream is not configured.",
    });
  }

  return { accountId: accountId!, token: token! };
}

async function cloudflareJson<T>(path: string, init: RequestInit): Promise<T> {
  const { accountId, token } = assertConfigured();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ProviderError({
      provider: "cloudflare_stream",
      code: statusToProviderError(response.status),
      message: `Cloudflare API request failed with status ${response.status}`,
      statusCode: response.status,
    });
  }

  const payload = (await response.json()) as CloudflareApiResponse<T>;
  if (!payload.success) {
    const firstError = payload.errors?.[0]?.message;
    throw new ProviderError({
      provider: "cloudflare_stream",
      code: "request_failed",
      message: firstError?.trim() ? `Cloudflare API rejected request: ${firstError}` : "Cloudflare API returned an unsuccessful response.",
      statusCode: response.status,
    });
  }

  if (typeof payload.result === "undefined") {
    throw new ProviderError({
      provider: "cloudflare_stream",
      code: "invalid_response",
      message: "Cloudflare API returned an invalid response payload.",
      statusCode: response.status,
    });
  }

  return payload.result;
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

function toLiveInputDescriptor(result: CloudflareLiveInput): LiveInputDescriptor {
  return {
    liveInputId: result.uid,
    playbackId: result.uid,
    playbackHlsUrl: result.playback?.hls ?? null,
    ingestRtmpsUrl: result.rtmps?.url ?? null,
    ingestSrtUrl: result.srt?.url ?? null,
    ingestCredentialsIssued: Boolean(result.rtmps?.streamKey || result.srt?.passphrase),
    providerStatus: result.status ?? null,
  };
}

function playbackHostFromHls(hlsUrl: string | null) {
  if (!hlsUrl) {
    return null;
  }

  try {
    return new URL(hlsUrl).host;
  } catch {
    return null;
  }
}

export class CloudflareLiveStreamProvider implements LiveStreamProvider {
  readonly providerKey = "cloudflare_stream";

  isConfigured() {
    return configured(process.env.CLOUDFLARE_STREAM_ACCOUNT_ID) && configured(process.env.CLOUDFLARE_STREAM_API_TOKEN);
  }

  async createLiveInput(input: CreateLiveInputRequest): Promise<LiveInputDescriptor> {
    const result = await cloudflareJson<CloudflareLiveInput>("/stream/live_inputs", {
      method: "POST",
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        enabled: true,
        meta: {
          name: input.label,
          venueId: String(input.venueId),
          cameraId: String(input.cameraId),
        },
        recording: {
          mode: "automatic",
          requireSignedURLs: true,
          hideLiveViewerCount: true,
        },
      }),
    });

    return toLiveInputDescriptor(result);
  }

  async getLiveInput(liveInputId: string): Promise<LiveInputDescriptor> {
    const result = await cloudflareJson<CloudflareLiveInput>(`/stream/live_inputs/${liveInputId}`, {
      method: "GET",
    });

    return toLiveInputDescriptor(result);
  }

  async disableLiveInput(liveInputId: string): Promise<void> {
    await cloudflareJson<CloudflareLiveInput>(`/stream/live_inputs/${liveInputId}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    });
  }

  async getStreamHealth(liveInputId: string): Promise<LiveStreamHealth> {
    const input = await this.getLiveInput(liveInputId);
    const playbackHost = playbackHostFromHls(input.playbackHlsUrl);

    let lifecycleLive: boolean | null = null;
    let activeVideoId: string | null = null;

    if (playbackHost) {
      try {
        const lifecycleResponse = await fetch(`https://${playbackHost}/${liveInputId}/lifecycle`, {
          method: "GET",
          cache: "no-store",
        });
        if (lifecycleResponse.ok) {
          const lifecycle = (await lifecycleResponse.json()) as CloudflareLifecycle;
          lifecycleLive = lifecycle.live === true;
          activeVideoId = lifecycle.videoUID ?? null;
        }
      } catch {
        lifecycleLive = null;
      }
    }

    const status = (input.providerStatus ?? "").toLowerCase();
    const inferredLive = status === "connected" || status === "reconnected";

    return {
      providerStatus: input.providerStatus,
      isLive: lifecycleLive ?? inferredLive,
      activeVideoId,
      playbackHost,
    };
  }

  async createPlaybackAuthorization(videoId: string, expiresAtUnix: number): Promise<PlaybackAuthorization> {
    const result = await cloudflareJson<{ token: string }>(`/stream/${videoId}/token`, {
      method: "POST",
      body: JSON.stringify({ exp: expiresAtUnix }),
    });

    return {
      token: result.token,
      expiresAtUnix,
    };
  }
}
