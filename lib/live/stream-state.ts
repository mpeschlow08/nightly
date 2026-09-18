export type NightlyStreamState = "provisioning" | "ready" | "live" | "offline" | "error" | "disabled";

export type CameraProvisioningStatus = "unprovisioned" | "provisioning" | "ready" | "error";

// Cloudflare Stream statuses plus Mux live stream statuses (active/idle/disabled).
const LIVE_STATUSES = new Set(["connected", "reconnected", "active"]);
const OFFLINE_STATUSES = new Set(["client_disconnect", "ttl_exceeded", "idle", "disabled"]);
const ERROR_STATUSES = new Set(["failed_to_connect", "failed_to_reconnect", "errored"]);

export function mapProvisioningStatus(value: string | null | undefined): CameraProvisioningStatus {
  if (value === "provisioning" || value === "ready" || value === "error" || value === "unprovisioned") {
    return value;
  }
  return "unprovisioned";
}

export function mapNightlyStreamState(input: {
  cameraEnabled: boolean;
  provisioningStatus: string | null | undefined;
  providerStatus: string | null | undefined;
  lifecycleLive?: boolean | null;
}): NightlyStreamState {
  if (!input.cameraEnabled) {
    return "disabled";
  }

  const provisioningStatus = mapProvisioningStatus(input.provisioningStatus);
  if (provisioningStatus === "provisioning" || provisioningStatus === "unprovisioned") {
    return "provisioning";
  }
  if (provisioningStatus === "error") {
    return "error";
  }

  if (input.lifecycleLive === true) {
    return "live";
  }

  const providerStatus = (input.providerStatus ?? "").trim().toLowerCase();
  if (LIVE_STATUSES.has(providerStatus)) {
    return "live";
  }
  if (ERROR_STATUSES.has(providerStatus)) {
    return "error";
  }
  if (OFFLINE_STATUSES.has(providerStatus) || providerStatus === "reconnecting") {
    return "offline";
  }

  return "ready";
}

export function isNightlyLiveState(state: NightlyStreamState) {
  return state === "live";
}
