export type HotReelProviderErrorCode =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "request_failed"
  | "invalid_response";

export class HotReelProviderError extends Error {
  readonly code: HotReelProviderErrorCode;
  readonly provider: string;
  readonly statusCode: number | null;

  constructor(input: { provider: string; code: HotReelProviderErrorCode; message: string; statusCode?: number | null }) {
    super(input.message);
    this.name = "HotReelProviderError";
    this.provider = input.provider;
    this.code = input.code;
    this.statusCode = input.statusCode ?? null;
  }
}

export type HotReelStorageDescriptor = {
  objectKey: string;
  providerObjectId: string | null;
  providerKey: string;
  status: string;
  sizeBytes: number | null;
  sha256: string | null;
  playbackUrl: string | null;
  expiresAt: number | null;
};

export type HotReelUploadAuthorization = {
  objectKey: string;
  uploadUrl: string;
  expiresAt: number;
  expectedBytes?: number;
  expectedSha256?: string;
  contentType?: string;
  providerUploadId?: string;
};

export type HotReelPlaybackAuthorization = {
  token: string;
  url: string;
  expiresAt: number;
};

export type HotReelIntegrityResult = {
  ok: boolean;
  sizeBytes: number;
  sha256: string | null;
  providerStatus: string;
  failureCode?: string;
};

export type HotReelUploadRequest = {
  hotMomentId: string;
  venueId: number;
  deviceId: number;
  sourceId: number;
  durationMs: number | null;
  contentType?: string;
  expectedBytes?: number;
  expectedSha256?: string;
};

export interface HotReelStorageProvider {
  readonly providerKey: string;
  isConfigured(): boolean;
  createUploadAuthorization(input: HotReelUploadRequest): Promise<HotReelUploadAuthorization>;
  verifyObject(objectKey: string, options?: { expectedBytes?: number; expectedSha256?: string }): Promise<HotReelIntegrityResult>;
  finalizeUpload(objectKey: string): Promise<{ ok: boolean; providerObjectKey: string; providerStatus: string }>;
  createPlaybackAuthorization(input: { objectKey: string; expiresAt: number }): Promise<HotReelPlaybackAuthorization>;
  deleteObject(objectKey: string): Promise<void>;
  getObjectStatus(objectKey: string): Promise<{ status: string; sizeBytes: number | null; sha256: string | null }>;
}
