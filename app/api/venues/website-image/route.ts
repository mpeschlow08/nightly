import { NextResponse } from "next/server";

import {
  assertPublicHttpUrl,
  fetchWithSafeRedirects,
  readResponseWithinLimit,
} from "@/app/owner/lib/image-fetch-security";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_IMAGE_BYTES = 9 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const sourceUrl = requestUrl.searchParams.get("url");

    if (!sourceUrl) {
      return NextResponse.json({ error: "Image URL is required." }, { status: 400 });
    }

    const validatedUrl = assertPublicHttpUrl(sourceUrl);
    const response = await fetchWithSafeRedirects(validatedUrl, {
      timeoutMs: 7000,
      maxRedirects: 2,
      userAgent: "NightlyBot/1.0 (+https://nightly.local)",
      accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch website image." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

    if (!ACCEPTED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported website image content type." }, { status: 415 });
    }

    const bytes = await readResponseWithinLimit(response, MAX_IMAGE_BYTES);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch website image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
