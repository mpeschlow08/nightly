import type { CommissioningCheckKey, CommissioningCheckStatus } from "./policy";

export type FleetCommissioningStep = {
  key: string;
  status: "pending" | "running" | "passed" | "warning" | "failed" | "skipped";
};

type RecordedCheck = { checkKey: CommissioningCheckKey; status: CommissioningCheckStatus; evidenceJson?: string };
type Source = { sourceType: string; enabled: boolean };

function recordedStatus(check: RecordedCheck | undefined): FleetCommissioningStep["status"] {
  return check?.status === "pass" ? "passed" : check?.status === "warning" ? "warning" :
    check?.status === "fail" ? "failed" : check?.status === "checking" ? "running" : "pending";
}

function hasEvidence(check: RecordedCheck | undefined, key: string): boolean {
  if (check?.status !== "pass" || !check.evidenceJson || check.evidenceJson.length > 2048) return false;
  try { return (JSON.parse(check.evidenceJson) as Record<string, unknown>)[key] === true; } catch { return false; }
}

export function evaluateCommissioning(input: {
  publicDeviceUuid: string;
  serialNumber: string;
  enrolled: boolean;
  venueId: number | null;
  online: boolean;
  commercialState: string;
  agentVersion: string | null;
  desiredConfigRevision: string | null;
  appliedConfigRevision: string | null;
  checks: RecordedCheck[];
  sources: Source[];
}): { steps: FleetCommissioningStep[]; ready: boolean } {
  const checks = new Map(input.checks.map((check) => [check.checkKey, check]));
  const enabled = new Set(input.sources.filter((source) => source.enabled).map((source) => source.sourceType));
  const cameras = checks.get("cameras");
  const audio = checks.get("audio");
  const storage = checks.get("storage");
  const step = (key: string, status: FleetCommissioningStep["status"]): FleetCommissioningStep => ({ key, status });
  const steps = [
    step("identity", input.publicDeviceUuid && input.serialNumber ? "passed" : "pending"),
    step("enrollment", input.enrolled ? "passed" : "pending"),
    step("venue_assignment", input.venueId !== null ? "passed" : "pending"),
    step("agent_heartbeat", input.online ? "passed" : "pending"),
    step("network", recordedStatus(checks.get("internet"))),
    step("nightly_cloud", recordedStatus(checks.get("nightly_cloud"))),
    step("cameras", enabled.has("ip_camera") ? recordedStatus(cameras) : "pending"),
    step("capture_test", hasEvidence(cameras, "captureValidated") ? "passed" : "pending"),
    step("encoder", recordedStatus(checks.get("hardware_acceleration"))),
    step("program_audio", enabled.has("mixer_audio") ? recordedStatus(audio) : "pending"),
    step("ambient_audio", enabled.has("ambient_audio") ? recordedStatus(audio) : "skipped"),
    step("rolling_buffer", hasEvidence(storage, "rollingBufferReady") ? "passed" : "pending"),
    step("commercial", input.commercialState === "active" ? "passed" : "pending"),
    step("software", input.agentVersion && input.appliedConfigRevision && input.desiredConfigRevision === input.appliedConfigRevision ? "passed" : "pending"),
  ];
  const ready = steps.every((item) => item.status === "passed" || item.status === "skipped");
  return { steps: [...steps, step("ready", ready ? "passed" : "pending")], ready };
}