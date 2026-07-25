import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { djProfiles, users } from "@/db/schema";

const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
];

const ALLOWED_COVER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const MAX_AUDIO_SIZE_BYTES = 80 * 1024 * 1024;
const MAX_COVER_SIZE_BYTES = 8 * 1024 * 1024;

type UploadClientPayload = {
  djProfileId: number;
  uploadType?: "audio" | "cover";
};

function getPublicBlobReadWriteToken() {
  const token = process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error("Blob upload token is not configured.");
  }

  return token;
}

function parseDjProfileId(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("DJ profile ID must be a valid number.");
  }

  return value;
}

function parseClientPayload(clientPayload: string | null) {
  if (!clientPayload) {
    throw new Error("Missing upload payload.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(clientPayload);
  } catch {
    throw new Error("Upload payload is invalid.");
  }

  const djProfileId = parseDjProfileId((parsed as UploadClientPayload).djProfileId);
  const uploadType = (parsed as UploadClientPayload).uploadType;

  if (uploadType && uploadType !== "audio" && uploadType !== "cover") {
    throw new Error("Upload payload type is invalid.");
  }

  return { djProfileId, uploadType: uploadType ?? "audio" };
}

function expectedPathPrefix(djProfileId: number, uploadType: "audio" | "cover") {
  return uploadType === "cover"
    ? `dj-mixes/${djProfileId}/cover/`
    : `dj-mixes/${djProfileId}/audio/`;
}

async function assertAuthorizedDjProfile(djProfileId: number) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized. Please sign in.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { id: true, role: true },
  });

  if (!user || user.role !== "dj") {
    throw new Error("Forbidden. DJ account required.");
  }

  const profile = await db.query.djProfiles.findFirst({
    where: and(eq(djProfiles.id, djProfileId), eq(djProfiles.userId, user.id)),
    columns: { id: true },
  });

  if (!profile) {
    throw new Error("Forbidden. Profile ownership mismatch.");
  }
}

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request body." }, { status: 400 });
  }

  try {
    const blobToken = getPublicBlobReadWriteToken();

    const jsonResponse = await handleUpload({
      token: blobToken,
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { djProfileId, uploadType } = parseClientPayload(clientPayload);
        await assertAuthorizedDjProfile(djProfileId);

        const pathPrefix = expectedPathPrefix(djProfileId, uploadType);

        if (!pathname.startsWith(pathPrefix)) {
          throw new Error("Upload pathname is invalid for this DJ profile.");
        }

        return {
          allowedContentTypes:
            uploadType === "cover" ? ALLOWED_COVER_CONTENT_TYPES : ALLOWED_AUDIO_CONTENT_TYPES,
          maximumSizeInBytes: uploadType === "cover" ? MAX_COVER_SIZE_BYTES : MAX_AUDIO_SIZE_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ djProfileId, uploadType }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { djProfileId, uploadType } = parseClientPayload(tokenPayload ?? null);
        await assertAuthorizedDjProfile(djProfileId);

        const pathPrefix = expectedPathPrefix(djProfileId, uploadType);

        if (!blob.pathname.startsWith(pathPrefix)) {
          throw new Error("Uploaded file path is invalid.");
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to authorize upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
