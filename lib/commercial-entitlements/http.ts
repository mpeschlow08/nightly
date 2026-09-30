import { NextResponse } from "next/server";

import { CommercialEntitlementError } from "./service";

export function readCommercialJson(request: Request, maxBytes = 8 * 1024): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type");
  if (!contentType || !/^application\/json(?:\s*;|$)/i.test(contentType.trim())) return Promise.resolve(null);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) return Promise.resolve(null);
  return request.text().then((text) => {
    if (new TextEncoder().encode(text).byteLength > maxBytes) return null;
    try {
      const value: unknown = JSON.parse(text);
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch { return null; }
  }).catch(() => null);
}

export function commercialErrorResponse(error: unknown) {
  if (error instanceof CommercialEntitlementError) return NextResponse.json({ error: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ error: "internal_failure" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

export function commercialMutationSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}