import { head } from "@vercel/blob";

export type SocialUploadKind = "image" | "video" | "voice" | "story";

export const socialUploadLimits = {
  image: 12 * 1024 * 1024,
  video: 120 * 1024 * 1024,
  voice: 24 * 1024 * 1024,
  story: 24 * 1024 * 1024,
} satisfies Record<SocialUploadKind, number>;

export const socialUploadContentTypes = {
  image: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  voice: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav"],
  story: ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm", "video/quicktime"],
} satisfies Record<SocialUploadKind, string[]>;

export type SocialUploadPayload = {
  userId: number;
  kind: SocialUploadKind;
  scope: "group" | "conversation" | "story" | "direct";
  scopeId?: number | null;
};

export function parseSocialUploadPayload(clientPayload: string | null) {
  if (!clientPayload) {
    throw new Error("Missing upload payload.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(clientPayload);
  } catch {
    throw new Error("Upload payload is invalid.");
  }

  const payload = parsed as Partial<SocialUploadPayload>;
  if (!payload.userId || !Number.isInteger(payload.userId)) {
    throw new Error("Upload payload user is invalid.");
  }

  if (!payload.kind || !(payload.kind in socialUploadLimits)) {
    throw new Error("Upload payload kind is invalid.");
  }

  if (!payload.scope || !["group", "conversation", "story", "direct"].includes(payload.scope)) {
    throw new Error("Upload payload scope is invalid.");
  }

  return {
    userId: payload.userId,
    kind: payload.kind,
    scope: payload.scope,
    scopeId: payload.scopeId ?? null,
  } satisfies SocialUploadPayload;
}

export function socialUploadPathPrefix(userId: number, kind: SocialUploadKind) {
  return `social-media/${userId}/${kind}/`;
}

export function validateSocialBlobUrl(value: string, userId: number, kind: SocialUploadKind) {
  const raw = value.trim();
  if (!raw) {
    throw new Error("Blob URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Blob URL must be a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Blob URL must use https.");
  }

  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    throw new Error("Blob URL must be a Vercel Blob URL.");
  }

  if (!parsed.pathname.startsWith(`/${socialUploadPathPrefix(userId, kind)}`)) {
    throw new Error("Blob URL path is invalid for this social upload.");
  }

  return parsed.toString();
}

export async function readSocialBlobMetadata(input: { blobUrl: string; userId: number; kind: SocialUploadKind }) {
  const token = process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("Blob upload token is not configured.");
  }

  const normalizedUrl = validateSocialBlobUrl(input.blobUrl, input.userId, input.kind);
  const blob = await head(normalizedUrl, { token });

  if (!socialUploadContentTypes[input.kind].includes(blob.contentType)) {
    throw new Error("Uploaded media type is not supported for this action.");
  }

  if (blob.size <= 0) {
    throw new Error("Uploaded media is empty.");
  }

  if (blob.size > socialUploadLimits[input.kind]) {
    throw new Error("Uploaded media exceeds the allowed size.");
  }

  return blob;
}