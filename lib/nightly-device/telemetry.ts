export type FleetTelemetry = {
  schemaVersion: 1;
  uptimeSeconds: number;
  memoryTotalBytes: number;
  memoryAvailableBytes: number;
  appliedConfigRevision: string | null;
  storageTotalBytes?: number;
  storageFreeBytes?: number;
  cameraCount?: number;
  healthyCameraCount?: number;
  uploadQueueDepth?: number;
  restartCount?: number;
};

export function parseFleetTelemetry(value: unknown): FleetTelemetry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length < 5 || keys.length > 11 || keys.some((key) => !["schemaVersion", "uptimeSeconds", "memoryTotalBytes", "memoryAvailableBytes", "appliedConfigRevision", "storageTotalBytes", "storageFreeBytes", "cameraCount", "healthyCameraCount", "uploadQueueDepth", "restartCount"].includes(key))) return null;
  if (input.schemaVersion !== 1 || !Number.isSafeInteger(input.uptimeSeconds) || (input.uptimeSeconds as number) < 0 || (input.uptimeSeconds as number) > 1_000_000_000) return null;
  if (!Number.isSafeInteger(input.memoryTotalBytes) || (input.memoryTotalBytes as number) < 1 || !Number.isSafeInteger(input.memoryAvailableBytes) || (input.memoryAvailableBytes as number) < 0 || (input.memoryAvailableBytes as number) > (input.memoryTotalBytes as number)) return null;
  if (input.appliedConfigRevision !== null && (typeof input.appliedConfigRevision !== "string" || input.appliedConfigRevision.length > 64 || !/^[a-zA-Z0-9._:-]*$/.test(input.appliedConfigRevision))) return null;
  for (const key of ["storageTotalBytes", "storageFreeBytes", "cameraCount", "healthyCameraCount", "uploadQueueDepth", "restartCount"]) {
    if (input[key] !== undefined && (!Number.isSafeInteger(input[key]) || (input[key] as number) < 0 || (input[key] as number) > 1_000_000_000_000_000)) return null;
  }
  if (input.storageFreeBytes !== undefined && (input.storageTotalBytes === undefined || (input.storageTotalBytes as number) < 1 || (input.storageFreeBytes as number) > (input.storageTotalBytes as number))) return null;
  if (input.healthyCameraCount !== undefined && (input.cameraCount === undefined || (input.healthyCameraCount as number) > (input.cameraCount as number))) return null;
  if (["cameraCount", "healthyCameraCount", "uploadQueueDepth", "restartCount"].some((key) => input[key] !== undefined && (input[key] as number) > 100_000)) return null;
  return input as FleetTelemetry;
}

export async function readBoundedJson(request: Request, maxBytes = 4096): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("missing_body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("oversized_body");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}