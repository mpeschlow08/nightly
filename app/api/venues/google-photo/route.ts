import { NextResponse } from "next/server";

function parseMaxWidthPx(value: string | null) {
  if (!value) {
    return 1600;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 200 || parsed > 3200) {
    return 1600;
  }

  return parsed;
}

function normalizeRef(value: string | null) {
  if (!value) {
    throw new Error("Google photo reference is required.");
  }

  const normalized = value.trim().replace(/^\/+/, "");

  if (!normalized || /[^A-Za-z0-9_\/-]/.test(normalized)) {
    throw new Error("Google photo reference is invalid.");
  }

  return normalized;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ref = normalizeRef(url.searchParams.get("ref"));
    const maxWidthPx = parseMaxWidthPx(url.searchParams.get("maxWidthPx"));
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured." }, { status: 500 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const upstream = await fetch(
      `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${maxWidthPx}&key=${encodeURIComponent(apiKey)}`,
      {
        method: "GET",
        headers: {
          "User-Agent": "NightlyBot/1.0 (+https://nightly.local)",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to load Google Place photo." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const cacheControl = upstream.headers.get("cache-control") ?? "public, max-age=3600";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("required")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("invalid")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to proxy Google photo." }, { status: 502 });
  }
}
