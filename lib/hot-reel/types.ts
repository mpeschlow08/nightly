export type HotReelLifecycleState =
  | "local_ready"
  | "upload_pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "expired"
  | "deleting"
  | "deleted";

export type HotReelPublicationState = "private" | "review" | "published" | "unpublished";
export type HotReelReviewState = "pending" | "approved" | "hidden";

export type HotReelActor = {
  userId: string | number;
  role: "owner" | "tech" | "artist" | "consumer";
  venueId?: number;
};

export type HotReelRecord = {
  id: string;
  publicId: string;
  hotMomentId: string;
  venueId: number;
  deviceId: number;
  sourceId: number;
  sessionId: number | null;
  lifecycleState: HotReelLifecycleState;
  publicationState: HotReelPublicationState;
  reviewState: HotReelReviewState;
  providerKey: string;
  providerObjectKey: string | null;
  providerObjectVersion: number;
  contentHash: string | null;
  contentBytes: number | null;
  contentType: string;
  durationMs: number | null;
  capturedAt: number | null;
  uploadedAt: number | null;
  finalizedAt: number | null;
  expiresAt: number | null;
  deletedAt: number | null;
  failureCode: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
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

export type HotReelIntegrityResult = {
  ok: boolean;
  sizeBytes: number;
  sha256: string | null;
  providerStatus: string;
  failureCode?: string;
};

export type HotReelPlaybackAuthorization = {
  allowed: boolean;
  reason?: string;
  url?: string;
  token?: string;
  expiresAt: number;
};

export type HotReelProvider = {
  readonly providerKey: string;
  isConfigured(): boolean;
  createUploadAuthorization(input: HotReelUploadRequest): Promise<HotReelUploadAuthorization>;
  verifyObject(objectKey: string, options?: { expectedBytes?: number; expectedSha256?: string; }): Promise<HotReelIntegrityResult>;
  finalizeUpload(objectKey: string): Promise<{ ok: boolean; providerObjectKey: string; providerStatus: string }>;
  createPlaybackAuthorization(input: { objectKey: string; expiresAt: number }): Promise<{ token: string; url: string; expiresAt: number }>;
  deleteObject(objectKey: string): Promise<void>;
  getObjectStatus(objectKey: string): Promise<{ status: string; sizeBytes: number | null; sha256: string | null }>;
};
