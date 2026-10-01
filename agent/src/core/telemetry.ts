import { freemem, totalmem, uptime } from "node:os";

import type { FleetTelemetry } from "../../../lib/nightly-device/telemetry";

export function collectFleetTelemetry(appliedConfigRevision: string | null): FleetTelemetry {
  const memoryTotalBytes = totalmem();
  const memoryAvailableBytes = freemem();
  return {
    schemaVersion: 1,
    uptimeSeconds: Math.min(1_000_000_000, Math.max(0, Math.floor(uptime()))),
    memoryTotalBytes,
    memoryAvailableBytes: Math.min(memoryTotalBytes, memoryAvailableBytes),
    appliedConfigRevision: appliedConfigRevision && appliedConfigRevision.length <= 64 && /^[a-zA-Z0-9._:-]*$/.test(appliedConfigRevision) ? appliedConfigRevision : null,
  };
}