import type { FleetTelemetry } from "./telemetry";

export function safeVersion(value: string | null): string | null {
  return value && /^[a-zA-Z0-9._+-]{1,64}$/.test(value) ? value : null;
}

export function buildFleetSupportBundle(input: {
  deviceId: number;
  agentVersion: string | null;
  softwareVersion: string | null;
  lastHeartbeatAt: Date | null;
  telemetry: FleetTelemetry | null;
  checks: Array<{ key: string; status: string }>;
  alerts: Array<{ code: string; severity: string; state: string }>;
  operations: Array<{ type: string; state: string; resultCode: string | null }>;
}, generatedAt: Date) {
  const bundle = {
    schemaVersion: 1,
    deviceId: input.deviceId,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + 15 * 60_000).toISOString(),
    agentVersion: safeVersion(input.agentVersion),
    softwareVersion: safeVersion(input.softwareVersion),
    lastHeartbeatAt: input.lastHeartbeatAt?.toISOString() ?? null,
    telemetry: input.telemetry,
    commissioning: input.checks.slice(0, 16).map(({ key, status }) => ({ key: /^[a-z_]{1,40}$/.test(key) ? key : "invalid", status: ["not_tested", "checking", "pass", "warning", "fail"].includes(status) ? status : "not_tested" })),
    alerts: input.alerts.slice(0, 20).map(({ code, severity, state }) => ({ code: /^[A-Z_]{3,64}$/.test(code) ? code : "UNKNOWN", severity: ["info", "warning", "critical"].includes(severity) ? severity : "warning", state: ["open", "acknowledged", "resolved"].includes(state) ? state : "resolved" })),
    operations: input.operations.slice(0, 20).map(({ type, state, resultCode }) => ({ type: /^[A-Z_]{3,64}$/.test(type) ? type : "UNKNOWN", state: ["pending", "acknowledged", "succeeded", "failed", "expired"].includes(state) ? state : "expired", resultCode: ["health_ok", "health_degraded"].includes(resultCode ?? "") ? resultCode : null })),
  };
  const json = JSON.stringify(bundle);
  if (Buffer.byteLength(json, "utf8") > 16 * 1024) throw new Error("support_bundle_too_large");
  return json;
}