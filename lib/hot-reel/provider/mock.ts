import type { HotReelIntegrityResult, HotReelPlaybackAuthorization, HotReelStorageProvider, HotReelUploadAuthorization, HotReelUploadRequest } from "./types";

const defaultBytes = 128;
const defaultSha256 = "abc123";
const mockObjects = new Map<string, { sizeBytes: number; sha256: string; status: string; playbackUrl: string; deleted: boolean }>();

export class MockHotReelProvider implements HotReelStorageProvider {
  readonly providerKey = "mock";
  private readonly objects = mockObjects;

  isConfigured(): boolean {
    return true;
  }

  async createUploadAuthorization(input: HotReelUploadRequest): Promise<HotReelUploadAuthorization> {
    const objectKey = `mock-hot-reels/${input.hotMomentId}.mp4`;
    const expiresAt = Date.now() + 60_000;
    const uploadUrl = `https://mock.hot-reel.local/upload/${objectKey}?expires=${expiresAt}&mode=write`;
    this.objects.set(objectKey, { sizeBytes: input.expectedBytes ?? defaultBytes, sha256: input.expectedSha256 ?? defaultSha256, status: "uploading", playbackUrl: `https://cdn.mock.example/${objectKey}?expires=${expiresAt}`, deleted: false });
    return {
      objectKey,
      uploadUrl,
      expiresAt,
      expectedBytes: input.expectedBytes ?? defaultBytes,
      expectedSha256: input.expectedSha256 ?? defaultSha256,
      contentType: input.contentType ?? "video/mp4",
      providerUploadId: `mock-upload-${input.hotMomentId}`,
    };
  }

  async verifyObject(objectKey: string, options?: { expectedBytes?: number; expectedSha256?: string; }): Promise<HotReelIntegrityResult> {
    const record = this.objects.get(objectKey);
    if (!record || record.deleted) {
      return { ok: false, sizeBytes: 0, sha256: null, providerStatus: "missing", failureCode: "missing_object" };
    }

    const expectedBytes = options?.expectedBytes ?? record.sizeBytes;
    const expectedSha256 = options?.expectedSha256 ?? record.sha256;
    const ok = record.sizeBytes === expectedBytes && record.sha256 === expectedSha256 && record.sizeBytes > 0;
    return {
      ok,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      providerStatus: ok ? "verified" : "mismatch",
      failureCode: ok ? undefined : "integrity_check_failed",
    };
  }

  async finalizeUpload(objectKey: string): Promise<{ ok: boolean; providerObjectKey: string; providerStatus: string }> {
    const record = this.objects.get(objectKey);
    if (!record || record.deleted) {
      throw new Error("provider_object_missing");
    }
    record.status = "ready";
    return { ok: true, providerObjectKey: objectKey, providerStatus: "ready" };
  }

  async createPlaybackAuthorization(input: { objectKey: string; expiresAt: number }): Promise<HotReelPlaybackAuthorization> {
    const record = this.objects.get(input.objectKey);
    if (!record || record.deleted) {
      throw new Error("provider_object_missing");
    }
    return {
      token: `mock-token-${input.objectKey}`,
      url: `${record.playbackUrl}&token=mock-token-${input.objectKey}`,
      expiresAt: input.expiresAt,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    const record = this.objects.get(objectKey);
    if (record) {
      record.deleted = true;
      record.status = "deleted";
    }
  }

  async getObjectStatus(objectKey: string): Promise<{ status: string; sizeBytes: number | null; sha256: string | null }> {
    const record = this.objects.get(objectKey);
    if (!record || record.deleted) {
      return { status: "missing", sizeBytes: null, sha256: null };
    }
    return { status: record.status, sizeBytes: record.sizeBytes, sha256: record.sha256 };
  }
}
