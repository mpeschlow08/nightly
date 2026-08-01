import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { parseSocialUploadPayload, socialUploadContentTypes, socialUploadLimits, socialUploadPathPrefix } from "@/lib/social/media";

function getBlobToken() {
  const token = process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("Blob upload token is not configured.");
  }

  return token;
}

async function getActorUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Sign in required.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { id: true },
  });

  if (!user) {
    throw new Error("User record not found.");
  }

  return user.id;
}

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request body." }, { status: 400 });
  }

  try {
    const actorUserId = await getActorUserId();
    const blobToken = getBlobToken();

    const response = await handleUpload({
      token: blobToken,
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseSocialUploadPayload(clientPayload);
        if (payload.userId !== actorUserId) {
          throw new Error("Upload user does not match the active account.");
        }

        const expectedPrefix = socialUploadPathPrefix(payload.userId, payload.kind);
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Upload pathname is invalid.");
        }

        return {
          allowedContentTypes: socialUploadContentTypes[payload.kind],
          maximumSizeInBytes: socialUploadLimits[payload.kind],
          addRandomSuffix: false,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parseSocialUploadPayload(tokenPayload ?? null);
        const expectedPrefix = socialUploadPathPrefix(payload.userId, payload.kind);
        if (!blob.pathname.startsWith(expectedPrefix)) {
          throw new Error("Uploaded social media path is invalid.");
        }
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to authorize social upload.";
    const status = message === "Sign in required." ? 401 : message === "User record not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}