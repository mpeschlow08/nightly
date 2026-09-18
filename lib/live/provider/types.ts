
export type LiveProviderInputStatus = string | null;

export type LiveInputDescriptor = {
  liveInputId: string;
  playbackId: string;
  playbackHlsUrl: string | null;
  ingestRtmpsUrl: string | null;
  ingestSrtUrl: string | null;
  ingestCredentialsIssued: boolean;
  providerStatus: LiveProviderInputStatus;
};

export type LiveStreamHealth = {
  providerStatus: LiveProviderInputStatus;
  isLive: boolean;
  activeVideoId: string | null;
  playbackHost: string | null;
};

export type PlaybackAuthorization = {
  token: string;
  expiresAtUnix: number;
  /** Set when the provider owns the playback URL shape (e.g. Mux signed HLS). */
  hlsUrl?: string | null;
};

export type LiveProviderErrorCode =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "request_failed"
  | "invalid_response";

export class LiveProviderError extends Error {
  readonly code: LiveProviderErrorCode;
  readonly provider: string;
  readonly statusCode: number | null;

  constructor(input: { provider: string; code: LiveProviderErrorCode; message: string; statusCode?: number | null }) {
    super(input.message);
    this.name = "LiveProviderError";
    this.provider = input.provider;
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
  }
}

export type CreateLiveInputRequest = {
  idempotencyKey: string;
  label: string;
  venueId: number;
  cameraId: number;
};

export interface LiveStreamProvider {
  readonly providerKey: string;
  isConfigured(): boolean;
  createLiveInput(input: CreateLiveInputRequest): Promise<LiveInputDescriptor>;
  getLiveInput(liveInputId: string): Promise<LiveInputDescriptor>;
  disableLiveInput(liveInputId: string): Promise<void>;
  getStreamHealth(liveInputId: string): Promise<LiveStreamHealth>;
  createPlaybackAuthorization(videoId: string, expiresAtUnix: number): Promise<PlaybackAuthorization>;
}
