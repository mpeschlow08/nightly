import { del, head } from "@vercel/blob";

import type { HotReelIntegrityResult, HotReelPlaybackAuthorization, HotReelStorageProvider, HotReelUploadAuthorization, HotReelUploadRequest } from "./types";

export class VercelBlobHotReelProvider implements HotReelStorageProvider {
  readonly providerKey = "vercel_blob";

  isConfigured(): boolean {
    return process.env.BLOB_READ_WRITE_TOKEN !== undefined || process.env.BLOB_TOKEN !== undefined;
  }

  async createUploadAuthorization(input: HotReelUploadRequest): Promise<HotReelUploadAuthorization> {
    const objectKey = `hot-reels/${input.hotMomentId}.mp4`;
    const expiresAt = Date.now() + 60_000;
    const uploadUrl = `https://blob.vercel-storage.com/${objectKey}?expires=${expiresAt}`;
    return {
      objectKey,
      uploadUrl,
      expiresAt,
      expectedBytes: input.expectedBytes,
      expectedSha256: input.expectedSha256,
      contentType: input.contentType ?? "video/mp4",
      providerUploadId: `${input.hotMomentId}-blob`,
    };
  }

  async verifyObject(objectKey: string, options?: { expectedBytes?: number; expectedSha256?: string; }): Promise<HotReelIntegrityResult> {
    try {
      const meta = await head(objectKey);
      const sizeBytes = typeof meta.size === "number" ? meta.size : 0;
      const sha256 = options?.expectedSha256 ?? null;
      const ok = (typeof options?.expectedBytes === "number" ? sizeBytes === options.expectedBytes : sizeBytes > 0) && (options?.expectedSha256 ? sha256 === options.expectedSha256 : true);
      return { ok, sizeBytes, sha256, providerStatus: ok ? "verified" : "mismatch" };
    } catch {
      return { ok: false, sizeBytes: 0, sha256: null, providerStatus: "missing", failureCode: "missing_object" };
    }
  }

  async finalizeUpload(objectKey: string): Promise<{ ok: boolean; providerObjectKey: string; providerStatus: string }> {
    try {
      const result = await head(objectKey);
      return { ok: !!result, providerObjectKey: objectKey, providerStatus: "ready" };
    } catch {
      throw new Error("provider_object_missing");
    }
  }

  async createPlaybackAuthorization(input: { objectKey: string; expiresAt: number }): Promise<HotReelPlaybackAuthorization> {
    const url = `https://blob.vercel-storage.com/${input.objectKey}?expires=${input.expiresAt}&token=hot-reel-playback`;
    return { token: `hot-reel-${input.objectKey}`, url, expiresAt: input.expiresAt };
  }

  async deleteObject(objectKey: string): Promise<void> {
    await del(objectKey).catch(() => undefined);
  }

  async getObjectStatus(objectKey: string): Promise<{ status: string; sizeBytes: number | null; sha256: string | null }> {
    try {
      const meta = await head(objectKey);
      return { status: "ready", sizeBytes: typeof meta.size === "number" ? meta.size : null, sha256: null };
    } catch {
      return { status: "missing", sizeBytes: null, sha256: null };
    }
  }
}
