import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/platform/rate-limit";
import { safeSocialError } from "@/lib/social-publishing/errors";

export function parseVenueId(value: string | null): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function sameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function socialMutationRateLimit(venueId: number, route: string) {
  return consumeRateLimit({
    key: String(venueId),
    scope: "venue",
    burstLimit: 10,
    sustainedLimit: 60,
    windowMs: 60_000,
    route,
  });
}

export function socialErrorResponse(error: unknown) {
  const safe = safeSocialError(error);
  return NextResponse.json({ error: safe.code }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const maxBytes = 16 * 1024;
  const contentType = request.headers.get("content-type");
  if (!contentType || !/^application\/json(?:\s*;|$)/i.test(contentType.trim())) return null;
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > maxBytes)) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
