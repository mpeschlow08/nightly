import { SocialProviderError } from "../types";
import type { SocialPublicationAuthorization, SocialPublicationRecord, SocialProviderPublicationStatus, SocialPublishingActor, SocialPublishingProvider } from "../types";
import { getProviderCapabilities } from "../capabilities";

export class MockSocialPublishingProvider implements SocialPublishingProvider {
  readonly providerKey = "mock";

  private readonly posts = new Map<string, { providerPostId: string; providerUrl: string; status: "processing" | "published" | "failed" | "revoked"; revoked: boolean }>();
  private readonly idempotentPosts = new Map<string, string>();
  private readonly failures = new Map<string, { remaining: number; code: ConstructorParameters<typeof SocialProviderError>[0]; retryable: boolean }>();
  private readonly processingPublishes: boolean;

  constructor(options?: { failures?: Record<string, number | { count: number; code?: ConstructorParameters<typeof SocialProviderError>[0]; retryable?: boolean }>; processingPublishes?: boolean }) {
    this.processingPublishes = options?.processingPublishes ?? false;
    for (const [operation, failure] of Object.entries(options?.failures ?? {})) {
      this.failures.set(operation, typeof failure === "number"
        ? { remaining: failure, code: "retryable_provider_error", retryable: true }
        : { remaining: failure.count, code: failure.code ?? "retryable_provider_error", retryable: failure.retryable ?? true });
    }
  }

  isConfigured(): boolean {
    return true;
  }

  getCapabilities(_platform: Parameters<typeof getProviderCapabilities>[1]) {
    return getProviderCapabilities(this.providerKey, _platform);
  }

  private maybeFail(operation: string) {
    const failure = this.failures.get(operation);
    if (!failure || failure.remaining <= 0) return;
    this.failures.set(operation, { ...failure, remaining: failure.remaining - 1 });
    throw new SocialProviderError(failure.code, failure.retryable);
  }

  async validateConnection(input: { platform: Parameters<typeof getProviderCapabilities>[1]; credential: string | null }) {
    if (input.credential === null || !input.credential.startsWith("mock:")) {
      return { valid: false, reconnectRequired: true, expiresAt: null, grantedScopes: [] };
    }
    return { valid: true, reconnectRequired: false, expiresAt: null, grantedScopes: ["mock:publish"] };
  }

  async preparePublication(input: { platform: Parameters<typeof getProviderCapabilities>[1]; accountPublicId: string; credential: string; mediaObjectRef: string; caption: string; idempotencyKey: string }) {
    this.maybeFail("preparePublication");
    if (!input.mediaObjectRef || input.mediaObjectRef.startsWith("http")) {
      throw new SocialProviderError("invalid_media", false);
    }
    return { preparationId: `mock-prepare-${input.idempotencyKey}` };
  }

  async uploadMedia(input: { preparationId: string; credential: string; mediaUrl: string }) {
    this.maybeFail("uploadMedia");
    if (!input.mediaUrl.startsWith("https://")) throw new SocialProviderError("invalid_media", false);
    return { providerMediaId: `mock-media-${input.preparationId}` };
  }

  async publish(record: SocialPublicationRecord, input?: { idempotencyKey?: string; providerMediaId?: string }): Promise<{ ok: boolean; providerPostId: string; providerUrl?: string; providerStatus: string }> {
    this.maybeFail("publish");
    const idempotencyKey = input?.idempotencyKey;
    const existingId = idempotencyKey ? this.idempotentPosts.get(idempotencyKey) : undefined;
    const providerPostId = existingId ?? record.providerPostId ?? `mock-post-${record.entityId}-${record.platform}`;
    const data = this.posts.get(providerPostId) ?? { providerPostId, providerUrl: record.providerUrl ?? `https://social.mock.example/${record.platform}/${providerPostId}`, status: "processing" as const, revoked: false };
    data.status = this.processingPublishes ? "processing" : "published";
    this.posts.set(providerPostId, data);
    if (idempotencyKey) this.idempotentPosts.set(idempotencyKey, providerPostId);
    return { ok: true, providerPostId, providerUrl: data.providerUrl, providerStatus: data.status };
  }

  completeProcessing(providerPublicationId: string) {
    const post = this.posts.get(providerPublicationId);
    if (post && post.status === "processing") post.status = "published";
  }

  async inspectPublication(input: { providerPublicationId: string; credential?: string }): Promise<SocialProviderPublicationStatus> {
    this.maybeFail("inspectPublication");
    const post = this.posts.get(input.providerPublicationId);
    if (!post) return { state: "unknown", providerPublicationId: null, providerUrl: null };
    return {
      state: post.status === "revoked" ? "failed" : post.status,
      providerPublicationId: post.providerPostId,
      providerUrl: post.providerUrl,
    };
  }

  async findPublicationByIdempotencyKey(input: { idempotencyKey: string; credential?: string }): Promise<SocialProviderPublicationStatus> {
    const providerPublicationId = this.idempotentPosts.get(input.idempotencyKey);
    if (!providerPublicationId) return { state: "unknown", providerPublicationId: null, providerUrl: null };
    return this.inspectPublication({ providerPublicationId });
  }

  async revoke(record: SocialPublicationRecord): Promise<{ ok: boolean; providerPostId: string; providerStatus: string }> {
    this.maybeFail("revoke");
    const providerPostId = record.providerPostId ?? `mock-post-${record.entityId}-${record.platform}`;
    const data = this.posts.get(providerPostId) ?? { providerPostId, providerUrl: record.providerUrl ?? "https://social.mock.example/preview", status: "published" as const, revoked: false };
    data.status = "revoked";
    data.revoked = true;
    this.posts.set(providerPostId, data);
    return { ok: true, providerPostId, providerStatus: "revoked" };
  }

  async refreshAuthorization(input: { credential: string }) {
    if (!input.credential.startsWith("mock:")) {
      return { valid: false, reconnectRequired: true, expiresAt: null };
    }
    return { valid: true, reconnectRequired: false, expiresAt: null };
  }

  async authorizePublicationAccess(input: { record: SocialPublicationRecord; actor: SocialPublishingActor; now?: number }): Promise<SocialPublicationAuthorization> {
    const { record, actor } = input;
    if (record.lifecycleState === "revoked") {
      return { allowed: false, reason: "revoked" };
    }

    if (actor.role === "consumer") {
      return { allowed: false, reason: "not_authorized" };
    }

    if (actor.venueId !== record.venueId) {
      return { allowed: false, reason: "not_authorized" };
    }

    if (actor.role === "owner") {
      return { allowed: true, providerUrl: record.providerUrl ?? undefined, expiresAt: (input.now ?? Date.now()) + 60_000 };
    }

    return { allowed: false, reason: "not_authorized" };
  }
}
