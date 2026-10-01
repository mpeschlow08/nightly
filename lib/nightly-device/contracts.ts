import type { DeviceCapabilityRecord } from "./foundation";
import type { CommissioningCheckKey, CommissioningCheckStatus, CaptureSourceType } from "./policy";
import type { DeviceMediaBinding } from "./media-bindings";
import type { FleetTelemetry } from "./telemetry";

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
  telemetry?: FleetTelemetry;
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

export type CommercialDeviceDirective = {
  commercialState: string;
  reasonCode: string;
  allowedCapabilities: string[];
  revision: number;
  subscriptionRevision: number;
  issuedAt: string;
  refreshBy: string;
  offlineEntitlementExpiresAt: string;
  managementAvailable: true;
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
    commercial: CommercialDeviceDirective;
    media: {
      revision: string | null;
      ttlSeconds: number;
      sources: DeviceMediaBinding[];
    };
    performance?: {
      revision: string | null;
      ttlSeconds: number;
      sessions: Array<{ publicId: string; deviceId: number; venueId: number;
        sources: Array<{ sourceId: number; role: "camera" | "program_audio" | "ambient_audio" }>;
        startedAt: string; leaseExpiresAt: string; includeMicrophone: boolean; mediaRevision: number }>;
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