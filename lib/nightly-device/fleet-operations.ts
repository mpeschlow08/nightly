export const FLEET_OPERATION_SCOPES = {
  REQUEST_HEALTH_CHECK: "device.request_health_check",
  REQUEST_DIAGNOSTIC_SNAPSHOT: "device.read_diagnostics",
  REQUEST_SUPPORT_BUNDLE: "device.collect_support_bundle",
  RESTART_AGENT: "device.restart_agent",
  RETRY_COMMISSIONING_STEP: "device.retry_commissioning_step",
  REQUEST_UPDATE: "device.request_update",
} as const;

export type FleetOperationType = keyof typeof FLEET_OPERATION_SCOPES;
export type FleetSupportScope = typeof FLEET_OPERATION_SCOPES[FleetOperationType];

export function fleetOperationScope(value: unknown): FleetSupportScope | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FLEET_OPERATION_SCOPES, value)
    ? FLEET_OPERATION_SCOPES[value as FleetOperationType] : null;
}

export function supportGrantAllowsOperation(input: {
  actorClerkUserId: string;
  deviceId: number;
  scope: string;
  expiresAt: Date;
  revokedAt: Date | null;
}, actorClerkUserId: string, deviceId: number, operation: FleetOperationType, now: Date): boolean {
  return input.actorClerkUserId === actorClerkUserId && input.deviceId === deviceId &&
    input.scope === FLEET_OPERATION_SCOPES[operation] && input.revokedAt === null && input.expiresAt.getTime() > now.getTime();
}