import type {
  DeviceBootstrapRequest,
  DeviceBootstrapResponse,
  AgentDeviceConfig,
  AgentDeviceStatus,
  AgentHeartbeatRequest,
  AgentInventoryRequest,
  AgentCapabilityRequest,
  AgentCommissioningRequest,
} from "../../../lib/nightly-device/contracts";
import type { DeviceCapabilityRecord } from "../../../lib/nightly-device/foundation";
import type { CommissioningCheckKey, CommissioningCheckStatus, CaptureSourceType as DeviceSourceType } from "../../../lib/nightly-device/policy";

export type AgentState =
  | "STARTING"
  | "UNPROVISIONED"
  | "BOOTSTRAPPING"
  | "AUTHENTICATING"
  | "CONNECTING"
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE"
  | "SUSPENDED"
  | "RECOVERY_ONLY"
  | "UPDATING"
  | "RECOVERY_REQUIRED"
  | "ERROR"
  | "STOPPED";

export type ProbeAvailability = "SUPPORTED" | "UNSUPPORTED" | "NOT_AVAILABLE" | "NOT_TESTED" | "ERROR";
export type ProbeStatus = "not_tested" | "checking" | "pass" | "warning" | "fail";

export type ProbeResult = {
  key: CommissioningCheckKey;
  status: ProbeStatus;
  summary: string;
  checkedAt: string;
  evidence: Record<string, unknown>;
  remediationHint?: string;
};

export type AgentConfig = {
  controlPlaneUrl: string;
  deviceUuid: string;
  serialNumber: string;
  agentVersion: string;
  softwareVersion?: string;
  heartbeatIntervalMs: number;
  requestTimeoutMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
  stateDirectory: string;
  sourceDiscoveryWindowMs: number;
  simulation: boolean;
};

export type AgentPersistentState = {
  schemaVersion: 1;
  agentState: AgentState;
  deviceId: number | null;
  publicDeviceUuid: string | null;
  serialNumber: string | null;
  softwareVersion: string | null;
  agentVersion: string;
  desiredConfigRevision: string | null;
  appliedConfigRevision: string | null;
  policyConfig: ControlPlaneConfig | null;
  lastCloudContactAt: string | null;
  lastHeartbeatAt: string | null;
  lastErrorCode: string | null;
  simulation: boolean;
  updatedAt: string;
};

export type AgentCredentials = { deviceSecret: string };

export type ControlPlaneConfig = AgentDeviceConfig;
export type ControlPlaneStatus = AgentDeviceStatus;
export type ControlPlaneHeartbeat = AgentHeartbeatRequest;
export type ControlPlaneInventory = AgentInventoryRequest;
export type ControlPlaneCapabilities = AgentCapabilityRequest;
export type ControlPlaneCommissioning = AgentCommissioningRequest;
export type CaptureSource = { type: DeviceSourceType; label: string; venueCameraId?: number; evidence?: Record<string, unknown> };
export type CapabilityBundle = DeviceCapabilityRecord[];
export type CommissioningStatus = CommissioningCheckStatus;
export type CaptureKind = DeviceSourceType;
export type AgentBootstrapRequest = DeviceBootstrapRequest;
export type AgentBootstrapResponse = DeviceBootstrapResponse;
export type {
  AgentCommissioningRequest,
  AgentHeartbeatRequest,
  AgentInventoryRequest,
  AgentCapabilityRequest,
};

export type LogLevel = "debug" | "info" | "warn" | "error";
export type AgentLogger = {
  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void;
};

export const INITIAL_STATE: Omit<AgentPersistentState, "agentVersion" | "simulation" | "updatedAt"> = {
  schemaVersion: 1,
  agentState: "STARTING",
  deviceId: null,
  publicDeviceUuid: null,
  serialNumber: null,
  softwareVersion: null,
  desiredConfigRevision: null,
  appliedConfigRevision: null,
  policyConfig: null,
  lastCloudContactAt: null,
  lastHeartbeatAt: null,
  lastErrorCode: null,
};