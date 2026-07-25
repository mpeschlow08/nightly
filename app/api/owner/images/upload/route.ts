import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { assertMockOwnerVenueId } from "@/app/owner/lib/ownership";

const ALLOWED_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function getConfiguredBlobStoreId() {
  const storeId = process.env.PUBLIC_BLOB_STORE_ID?.trim();

  if (!storeId) {
    throw new Error("Blob store is not configured.");
  }

  return storeId;
}

function getPublicBlobReadWriteToken() {
  const token = process.env.PUBLIC_BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error("Blob upload token is not configured.");
  }

  return token;
}

type UploadClientPayload = {
  venueId: number;
};

function parseVenueId(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Venue ID must be a valid number.");
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

  const venueId = parseVenueId((parsed as UploadClientPayload).venueId);

  return { venueId };
}

function expectedPathPrefix(venueId: number) {
  return `venue-images/${venueId}/`;
}

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request body." }, { status: 400 });
  }

  try {
    getConfiguredBlobStoreId();
    const blobToken = getPublicBlobReadWriteToken();

    const jsonResponse = await handleUpload({
      token: blobToken,
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { venueId } = parseClientPayload(clientPayload);
        assertMockOwnerVenueId(venueId);

        const pathPrefix = expectedPathPrefix(venueId);

        if (!pathname.startsWith(pathPrefix)) {
          throw new Error("Upload pathname is invalid for this venue.");
        }

        return {
          allowedContentTypes: ALLOWED_IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: MAX_IMAGE_SIZE_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ venueId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { venueId } = parseClientPayload(tokenPayload ?? null);
        const pathPrefix = expectedPathPrefix(venueId);

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
