import type { AgentCommissioningRequest, AgentInventoryRequest, AgentCapabilityRequest } from "../core/types";
import type { AgentConfig, ProbeAvailability, ProbeResult } from "../core/types";
import type { OnvifDevice } from "./onvif-discovery";

export type DiscoverySnapshot = {
  platform: string;
  architecture: string;
  probes: ProbeResult[];
  availability: Record<string, ProbeAvailability>;
  inventory: AgentInventoryRequest;
  capabilities: AgentCapabilityRequest;
  commissioning: AgentCommissioningRequest;
  onvifDevices: OnvifDevice[];
};

export interface PlatformProbeAdapter {
  discover(config: AgentConfig): Promise<DiscoverySnapshot>;
}

export function commissioningStatus(status: ProbeResult["status"]) {
  return status === "pass" || status === "warning" || status === "fail" ? status : "not_tested";
}