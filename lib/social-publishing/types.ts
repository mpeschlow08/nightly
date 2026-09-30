export type SocialPlatform = "instagram" | "facebook" | "tiktok" | "youtube" | "x";
export type SocialPublicationLifecycle = "draft" | "queued" | "processing" | "ready" | "published" | "failed" | "revoked";
export type SocialPublicationState = "draft" | "scheduled" | "published" | "unpublished";
export type SocialPublicationReviewState = "pending" | "approved" | "rejected" | "hidden";
export type SocialPublishingMode = "auto_publish" | "review_before_post" | "disabled";
export type SocialDestinationState = "queued" | "waiting_for_review" | "authorized" | "uploading" | "processing" | "published" | "failed_retryable" | "failed_permanent" | "revoke_requested" | "revoked" | "cancelled";

export const socialPublishingCapabilities = [
  "can_upload_video",
  "can_publish_video",
  "can_idempotently_publish",
  "can_delete_publication",
  "can_idempotently_delete_publication",
  "can_edit_publication",
  "can_schedule",
  "can_read_status",
  "can_read_analytics",
  "can_refresh_auth",
  "can_live_simulcast",
] as const;
export type SocialPublishingCapability = (typeof socialPublishingCapabilities)[number];

export type SocialProviderErrorCode =
  | "retryable_provider_error"
  | "provider_timeout"
  | "authorization_expired"
  | "authorization_revoked"
  | "unsupported_capability"
  | "policy_denied"
  | "invalid_media"
  | "permanent_provider_rejection"
  | "media_not_eligible"
  | "account_disconnected"
  | "internal_failure";

export class SocialProviderError extends Error {
  constructor(readonly code: SocialProviderErrorCode, readonly retryable: boolean) {
    super(code);
    this.name = "SocialProviderError";
  }
}

export type SocialPublishingActor = {
  userId: number;
  role: "owner" | "consumer";
  venueId?: number;
  clerkUserId?: string;
};

export type SocialPublicationRecord = {
  id: string;
  entityType: "hot_reel" | "event" | "venue" | "story" | "campaign";
  entityId: string;
  venueId: number;
  actorUserId: number;
  platform: SocialPlatform;
  lifecycleState: SocialPublicationLifecycle;
  publicationState: SocialPublicationState;
  reviewState: SocialPublicationReviewState;
  contentText: string;
  providerKey: string;
  providerPostId: string | null;
  providerUrl: string | null;
  publishedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type SocialPublicationAuthorization = {
  allowed: boolean;
  reason?: string;
  expiresAt?: number;
  providerUrl?: string;
  token?: string;
};

export type SocialProviderCapabilities = ReadonlySet<SocialPublishingCapability>;

export type SocialProviderPublicationStatus = {
  state: "processing" | "published" | "failed" | "unknown";
  providerPublicationId: string | null;
  providerUrl: string | null;
  failureCode?: SocialProviderErrorCode;
};

export type SocialPublishingProvider = {
  readonly providerKey: string;
  isConfigured(): boolean;
  getCapabilities(platform: SocialPlatform): SocialProviderCapabilities;
  validateConnection(input: { platform: SocialPlatform; credential: string | null }): Promise<{ valid: boolean; reconnectRequired: boolean; expiresAt: number | null; grantedScopes: string[] }>;
  preparePublication(input: { platform: SocialPlatform; accountPublicId: string; credential: string; mediaObjectRef: string; caption: string; idempotencyKey: string }): Promise<{ preparationId: string }>;
  uploadMedia(input: { preparationId: string; credential: string; mediaUrl: string }): Promise<{ providerMediaId: string }>;
  publish(record: SocialPublicationRecord, input?: { idempotencyKey?: string; providerMediaId?: string; credential?: string }): Promise<{ ok: boolean; providerPostId: string; providerUrl?: string; providerStatus: string }>;
  inspectPublication(input: { providerPublicationId: string; credential?: string }): Promise<SocialProviderPublicationStatus>;
  findPublicationByIdempotencyKey(input: { idempotencyKey: string; credential?: string }): Promise<SocialProviderPublicationStatus>;
  revoke(record: SocialPublicationRecord, input?: { credential?: string }): Promise<{ ok: boolean; providerPostId: string; providerStatus: string }>;
  refreshAuthorization(input: { credential: string }): Promise<{ valid: boolean; reconnectRequired: boolean; expiresAt: number | null; rotatedCredential?: string }>;
  authorizePublicationAccess(input: { record: SocialPublicationRecord; actor: SocialPublishingActor; now?: number }): Promise<SocialPublicationAuthorization>;
};
