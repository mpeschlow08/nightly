import { isAbsolute } from "node:path";
import type { AgentConfig } from "./types";

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error("Agent timing configuration is invalid.");
  return parsed;
}

export function loadAgentConfig(env: Partial<NodeJS.ProcessEnv> = process.env): AgentConfig {
  const rawUrl = env.NIGHTLY_CONTROL_PLANE_URL ?? "";
  let controlPlaneUrl: URL;
  try { controlPlaneUrl = new URL(rawUrl); } catch { throw new Error("NIGHTLY_CONTROL_PLANE_URL must be a valid URL."); }
  if (controlPlaneUrl.protocol !== "https:" && !(env.NODE_ENV !== "production" && controlPlaneUrl.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(controlPlaneUrl.hostname))) {
    throw new Error("Control Plane URL must use TLS outside local development.");
  }
  const deviceUuid = env.NIGHTLY_DEVICE_UUID ?? "";
  const serialNumber = env.NIGHTLY_SERIAL_NUMBER ?? "";
  const stateDirectory = env.NIGHTLY_AGENT_STATE_DIR ?? "/var/lib/nightly-agent";
  const simulation = env.NIGHTLY_AGENT_SIMULATION === "true";
  if (env.NODE_ENV === "production" && simulation) throw new Error("Simulation mode is not allowed in production.");
  if (stateDirectory && !isAbsolute(stateDirectory)) throw new Error("Agent state directory must be absolute.");

  return {
    controlPlaneUrl: controlPlaneUrl.toString().replace(/\/$/, ""),
    deviceUuid,
    serialNumber,
    agentVersion: env.NIGHTLY_AGENT_VERSION ?? "0.1.0",
    ...(env.NIGHTLY_BOX_SOFTWARE_VERSION ? { softwareVersion: env.NIGHTLY_BOX_SOFTWARE_VERSION.slice(0, 64) } : {}),
    heartbeatIntervalMs: boundedInt(env.NIGHTLY_HEARTBEAT_INTERVAL_MS, 30_000, 5_000, 300_000),
    requestTimeoutMs: boundedInt(env.NIGHTLY_REQUEST_TIMEOUT_MS, 10_000, 1_000, 60_000),
    retryBaseMs: boundedInt(env.NIGHTLY_RETRY_BASE_MS, 1_000, 100, 60_000),
    retryMaxMs: boundedInt(env.NIGHTLY_RETRY_MAX_MS, 60_000, 1_000, 600_000),
    stateDirectory,
    sourceDiscoveryWindowMs: boundedInt(env.NIGHTLY_SOURCE_DISCOVERY_WINDOW_MS, 3_000, 250, 10_000),
    simulation,
  };
}