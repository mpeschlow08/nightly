"use server";

import { head } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { djSampleMixes } from "@/db/schema";

import { requireDjProfileForDashboard } from "../lib/data";

const ALLOWED_AUDIO_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
]);

const ALLOWED_COVER_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const MAX_AUDIO_SIZE_BYTES = 80 * 1024 * 1024;
const MAX_COVER_SIZE_BYTES = 8 * 1024 * 1024;

type CreateDjMixInput = {
  title: string;
  description?: string | null;
  genre?: string | null;
  isPublic?: boolean;
  isFeatured?: boolean;
  audioUrl: string;
  coverImageUrl?: string | null;
};

type ActionResult =
  | { success: true; mixId?: number }
  | { success: false; error: string };

function mutationErrorPath(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const query = new URLSearchParams({ error: message });

  return `${path}?${query.toString()}`;
}

function mutationSuccessPath(path: string, success: string) {
  const query = new URLSearchParams({ success });

  return `${path}?${query.toString()}`;
}

function asOptionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function asRequiredString(value: FormDataEntryValue | null, label: string) {
  const text = asOptionalString(value);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function asInt(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function asValidBlobDjAssetUrl(value: string, expectedPrefix: string) {
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

  if (!parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error("Blob URL path is invalid for this DJ profile.");
  }

  return parsed.toString();
}

function parseDurationSeconds(contentType: string, size: number) {
  if (!contentType.startsWith("audio/")) {
    return null;
  }

  // Approximate duration from common bitrate for placeholder analytics.
  const estimatedBitrateKbps = 192;
  const seconds = Math.round((size * 8) / (estimatedBitrateKbps * 1000));

  return seconds > 0 ? seconds : null;
}

function revalidateDjPaths(username: string) {
  revalidatePath("/dj/dashboard");
  revalidatePath("/dj/mixes");
  revalidatePath("/dj/mixes/new");
  revalidatePath(`/dj/profile/${username}`);
}

async function enforceSingleFeaturedMix(djProfileId: number, mixId: number) {
  await db
    .update(djSampleMixes)
    .set({ isFeatured: false, updatedAt: new Date() })
    .where(and(eq(djSampleMixes.djProfileId, djProfileId), eq(djSampleMixes.isFeatured, true)));

  await db
    .update(djSampleMixes)
    .set({ isFeatured: true, updatedAt: new Date() })
    .where(and(eq(djSampleMixes.id, mixId), eq(djSampleMixes.djProfileId, djProfileId)));
}

export async function createDjMixFromBlobAction(input: CreateDjMixInput): Promise<ActionResult> {
  try {
    if (!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim()) {
      throw new Error("Blob upload token is not configured.");
    }

    const { profile } = await requireDjProfileForDashboard();

    const title = input.title.trim();

    if (!title) {
      throw new Error("Mix title is required.");
    }

    const audioUrl = asValidBlobDjAssetUrl(input.audioUrl, `/dj-mixes/${profile.id}/audio/`);
    const audioBlob = await head(audioUrl, { token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN });

    if (!ALLOWED_AUDIO_CONTENT_TYPES.has(audioBlob.contentType)) {
      throw new Error("Audio type is not supported. Use MP3, WAV, M4A, or AAC.");
    }

    if (audioBlob.size <= 0) {
      throw new Error("Audio file is empty.");
    }

    if (audioBlob.size > MAX_AUDIO_SIZE_BYTES) {
      throw new Error("Audio file must be 80 MB or smaller.");
    }

    let coverImageUrl: string | null = null;

    if (input.coverImageUrl && input.coverImageUrl.trim().length > 0) {
      const normalizedCoverUrl = asValidBlobDjAssetUrl(input.coverImageUrl, `/dj-mixes/${profile.id}/cover/`);
      const coverBlob = await head(normalizedCoverUrl, { token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN });

      if (!ALLOWED_COVER_CONTENT_TYPES.has(coverBlob.contentType)) {
        throw new Error("Cover image type is not supported.");
      }

      if (coverBlob.size <= 0) {
        throw new Error("Cover image file is empty.");
      }

      if (coverBlob.size > MAX_COVER_SIZE_BYTES) {
        throw new Error("Cover image must be 8 MB or smaller.");
      }

      coverImageUrl = coverBlob.url;
    }

    const now = new Date();
    const [created] = await db
      .insert(djSampleMixes)
      .values({
        djProfileId: profile.id,
        title,
        description: input.description?.trim() || null,
        audioUrl: audioBlob.url,
        audioFilename: audioBlob.pathname.split("/").pop() ?? null,
        durationSeconds: parseDurationSeconds(audioBlob.contentType, audioBlob.size),
        coverImageUrl,
        genre: input.genre?.trim() || null,
        isFeatured: false,
        isPublic: input.isPublic ?? true,
        playCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: djSampleMixes.id });

    if ((input.isFeatured ?? false) && created?.id) {
      await enforceSingleFeaturedMix(profile.id, created.id);
    }

    revalidateDjPaths(profile.username);

    return { success: true, mixId: created?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save sample mix.";
    return { success: false, error: message };
  }
}

export async function featureDjMixAction(formData: FormData) {
  try {
    const { profile } = await requireDjProfileForDashboard();
    const mixId = asInt(formData.get("mixId"), "Mix ID");

    const ownedMix = await db.query.djSampleMixes.findFirst({
      where: and(eq(djSampleMixes.id, mixId), eq(djSampleMixes.djProfileId, profile.id)),
      columns: { id: true },
    });

    if (!ownedMix) {
      throw new Error("Mix not found.");
    }

    await enforceSingleFeaturedMix(profile.id, mixId);
    revalidateDjPaths(profile.username);
    redirect(mutationSuccessPath("/dj/mixes", "Featured mix updated."));
  } catch (error) {
    redirect(mutationErrorPath("/dj/mixes", error));
  }
}

export async function toggleDjMixPublicAction(formData: FormData) {
  try {
    const { profile } = await requireDjProfileForDashboard();
    const mixId = asInt(formData.get("mixId"), "Mix ID");
    const isPublic = asBoolean(formData.get("isPublic"));

    const updated = await db
      .update(djSampleMixes)
      .set({ isPublic, updatedAt: new Date() })
      .where(and(eq(djSampleMixes.id, mixId), eq(djSampleMixes.djProfileId, profile.id)))
      .returning({ id: djSampleMixes.id });

    if (updated.length === 0) {
      throw new Error("Mix not found.");
    }

    revalidateDjPaths(profile.username);
    redirect(mutationSuccessPath("/dj/mixes", "Mix visibility updated."));
  } catch (error) {
    redirect(mutationErrorPath("/dj/mixes", error));
  }
}

export async function updateDjMixDetailsAction(formData: FormData) {
  try {
    const { profile } = await requireDjProfileForDashboard();
    const mixId = asInt(formData.get("mixId"), "Mix ID");
    const title = asRequiredString(formData.get("title"), "Mix title");
    const description = asOptionalString(formData.get("description"));
    const genre = asOptionalString(formData.get("genre"));

    const updated = await db
      .update(djSampleMixes)
      .set({
        title,
        description,
        genre,
        updatedAt: new Date(),
      })
      .where(and(eq(djSampleMixes.id, mixId), eq(djSampleMixes.djProfileId, profile.id)))
      .returning({ id: djSampleMixes.id });

    if (updated.length === 0) {
      throw new Error("Mix not found.");
    }

    revalidateDjPaths(profile.username);
    redirect(mutationSuccessPath("/dj/mixes", "Mix details updated."));
  } catch (error) {
    redirect(mutationErrorPath("/dj/mixes", error));
  }
}

export async function deleteDjMixAction(formData: FormData) {
  try {
    const { profile } = await requireDjProfileForDashboard();
    const mixId = asInt(formData.get("mixId"), "Mix ID");

    const deleted = await db
      .delete(djSampleMixes)
      .where(and(eq(djSampleMixes.id, mixId), eq(djSampleMixes.djProfileId, profile.id)))
      .returning({ id: djSampleMixes.id });

    if (deleted.length === 0) {
      throw new Error("Mix not found.");
    }

    revalidateDjPaths(profile.username);
    redirect(mutationSuccessPath("/dj/mixes", "Mix deleted."));
  } catch (error) {
    redirect(mutationErrorPath("/dj/mixes", error));
  }
}
