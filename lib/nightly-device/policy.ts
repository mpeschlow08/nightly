export type DeviceVenueActor = {
  role: "admin" | "owner" | "manager" | "tech_operator" | "unrelated";
  venueId: number | null;
};

export type DeviceVenueAction = "view" | "operate" | "lifecycle";

export function canAccessVenueDevice(input: {
  actor: DeviceVenueActor;
  deviceVenueId: number | null;
  action: DeviceVenueAction;
}) {
  const { actor, deviceVenueId, action } = input;
  if (actor.role === "admin") return true;
  if (deviceVenueId === null || actor.venueId !== deviceVenueId) return false;
  if (actor.role === "owner") return true;
  if (action === "lifecycle") return false;
  return actor.role === "manager" || actor.role === "tech_operator";
}

export function canUseDeviceForService(input: {
  lifecycleState: string;
  claimState: string;
  serviceEntitlementState: string;
  serviceSuspendedAt?: Date | null;
}) {
  return (
    (input.lifecycleState === "active" || input.lifecycleState === "degraded") &&
    input.claimState === "claimed" &&
    input.serviceEntitlementState === "active" &&
    input.serviceSuspendedAt == null
  );
}

export function isDeviceClaimUsable(input: {
  status: string;
  expiresAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
}, now = Date.now()) {
  return input.status === "pending" && input.usedAt == null && input.revokedAt == null &&
    (input.expiresAt == null || input.expiresAt.getTime() > now);
}

export function canBindUnassignedDevice(input: {
  venueId: number | null;
  claimState: string;
  lifecycleState: string;
}) {
  return input.venueId === null && input.claimState === "unclaimed" &&
    ["factory", "inventory", "provisioned", "unclaimed"].includes(input.lifecycleState);
}

export function canUseDeviceForManagement(input: {
  lifecycleState: string;
  managementRecoveryEligible: boolean;
  managementAccessLevel?: string;
}) {
  return (
    input.managementRecoveryEligible &&
    input.managementAccessLevel !== "disabled" &&
    input.lifecycleState !== "revoked" &&
    input.lifecycleState !== "retired"
  );
}

export function canUseDeviceForOperationalManagement(input: {
  lifecycleState: string;
  managementRecoveryEligible: boolean;
  managementAccessLevel?: string;
}) {
  return canUseDeviceForManagement(input) &&
    input.managementAccessLevel !== "recovery_only";
}

export type FleetHealth = "healthy" | "degraded" | "critical" | "offline" | "unknown";
export type FleetState = "provisioning" | "commissioning" | "ready" | "degraded" | "offline" | "suspended" | "maintenance" | "updating" | "recovery_required" | "decommissioned";
export type FleetConnectivity = "online" | "stale" | "offline" | "unknown";

export function evaluateFleetState(input: {
  lifecycleState: string;
  claimState: string;
  operationalState: string;
  serviceEntitlementState: string;
  lastHeartbeatAt: Date | null;
  commissioningReady?: boolean;
  updating?: boolean;
  recoveryRequired?: boolean;
}, now = Date.now()): { state: FleetState; health: FleetHealth; connectivity: FleetConnectivity; commercialState: string } {
  const age = input.lastHeartbeatAt ? Math.max(0, now - input.lastHeartbeatAt.getTime()) : null;
  const connectivity: FleetConnectivity = age === null ? "unknown" : age > 5 * 60_000 ? "offline" : age > 2 * 60_000 ? "stale" : "online";
  const health: FleetHealth = connectivity === "offline" ? "offline" : connectivity === "unknown" ? "unknown" :
    input.operationalState === "degraded" || connectivity === "stale" ? "degraded" :
    input.operationalState === "healthy" ? "healthy" :
    input.operationalState === "suspended" || input.operationalState === "maintenance" ? "unknown" : "critical";
  const commercialState = input.serviceEntitlementState;

  if (["retired", "revoked", "return_pending", "rma"].includes(input.lifecycleState)) return { state: "decommissioned", health, connectivity, commercialState };
  if (input.recoveryRequired) return { state: "recovery_required", health, connectivity, commercialState };
  if (input.updating) return { state: "updating", health, connectivity, commercialState };
  if (input.operationalState === "maintenance") return { state: "maintenance", health, connectivity, commercialState };
  if (input.claimState !== "claimed" || input.lifecycleState === "factory" || input.lifecycleState === "inventory" || input.lifecycleState === "provisioned") return { state: "provisioning", health, connectivity, commercialState };
  if (input.lifecycleState === "suspended" || commercialState === "suspended" || commercialState === "expired") return { state: "suspended", health, connectivity, commercialState };
  if (connectivity === "offline") return { state: "offline", health, connectivity, commercialState };
  if (input.commissioningReady === false || input.lifecycleState === "claimed" || connectivity === "unknown") return { state: "commissioning", health, connectivity, commercialState };
  if (health === "degraded" || health === "critical" || input.lifecycleState === "degraded") return { state: "degraded", health, connectivity, commercialState };
  return { state: "ready", health, connectivity, commercialState };
}

export type CommissioningCheckStatus = "not_tested" | "checking" | "pass" | "warning" | "fail";
export type CommissioningCheckKey =
  | "cameras"
  | "audio"
  | "hdmi"
  | "hardware_acceleration"
  | "storage"
  | "internet"
  | "nightly_cloud";

export const COMMISSIONING_CHECKS: readonly CommissioningCheckKey[] = [
  "cameras",
  "audio",
  "hdmi",
  "hardware_acceleration",
  "storage",
  "internet",
  "nightly_cloud",
];

export const NIGHTLY_DEVICE_DEFAULTS = {
  serviceEntitlementState: "inactive",
  privacyMode: "private",
  contentEligibility: "restricted",
  publicPublishingEnabled: false,
  hotReelEligible: false,
  liveEligible: false,
  privacyConfigRevision: 1,
} as const;

export type CaptureSourceType = "ip_camera" | "hdmi_input" | "mixer_audio" | "ambient_audio" | "other";
export const CAPTURE_SOURCE_TYPES: readonly CaptureSourceType[] = ["ip_camera", "hdmi_input", "mixer_audio", "ambient_audio", "other"];

export function isCaptureSourceType(value: unknown): value is CaptureSourceType {
  return typeof value === "string" && CAPTURE_SOURCE_TYPES.includes(value as CaptureSourceType);
}

export function normalizeCommissioningStatus(value: unknown): CommissioningCheckStatus {
  return value === "checking" || value === "pass" || value === "warning" || value === "fail"
    ? value
    : "not_tested";
}
