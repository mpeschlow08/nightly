import type { DeviceCapabilityRecord } from "./foundation";
import type { CommissioningCheckKey, CommissioningCheckStatus, CaptureSourceType } from "./policy";
import type { DeviceMediaBinding } from "./media-bindings";

export type DeviceBootstrapRequest = {
  publicDeviceUuid: string;
  serialNumber: string;
  bootstrapToken: string;
};

export type DeviceBootstrapResponse = {
  ok: true;
  device: {
    id: number;
    publicDeviceUuid: string;
    serialNumber: string;
    lifecycleState: string;
    claimState: string;
  };
  deviceSecret: string;
};

export type AgentHeartbeatRequest = {
  agentVersion?: string;
  softwareVersion?: string;
  operationalState?: "healthy" | "degraded";
};

export type AgentSourceReport = {
  sourceType: CaptureSourceType;
  sourceLabel: string;
  venueCameraId?: number | null;
  enabled?: boolean;
  evidence?: Record<string, unknown>;
};

export type AgentInventoryRequest = {
  sources: AgentSourceReport[];
};

export type AgentCapabilityRequest = {
  capabilities: DeviceCapabilityRecord[];
};

export type AgentCommissioningResult = {
  checkKey: CommissioningCheckKey;
  status: CommissioningCheckStatus;
  summary: string;
  checkedAt: string;
  evidence: Record<string, unknown>;
  remediationHint?: string | null;
};

export type AgentCommissioningRequest = {
  checks: AgentCommissioningResult[];
};

export type AgentDeviceConfig = {
  ok: true;
  deviceId: number;
  model: string;
  venueId: number | null;
  configRevision: string | null;
  configAvailable: boolean;
  sections: {
    privacy: {
      mode: string;
      contentEligibility: string;
      publicPublishingEnabled: boolean;
      revision: number;
    };
    service: {
      entitlementState: string;
      hotReelEligible: boolean;
      liveEligible: boolean;
      revision: number;
    };
    media: {
      revision: string | null;
      ttlSeconds: number;
      sources: DeviceMediaBinding[];
    };
    recovery: { enabled: boolean };
  };
  timestamp: string;
};

export type AgentDeviceStatus = {
  ok: true;
  device: {
    id: number;
    uuid: string;
    venueId: number | null;
    lifecycleState: string;
    operationalState: string;
    claimState: string;
    serviceEntitlementState: string;
    managementAccessLevel: string;
    lastHeartbeatAt: string | null;
    softwareVersion: string | null;
    agentVersion: string | null;
    timestamp: string;
  };
};