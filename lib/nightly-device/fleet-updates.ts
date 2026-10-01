import { gt, valid } from "semver";

import { verifyUpdateManifest, type SignedUpdateManifest } from "../../agent/src/core/ota";

export type FleetUpdateState = "scheduled" | "downloading" | "verifying" | "installing" | "restarting" | "health_check" | "succeeded" | "failed" | "rolled_back" | "recovery_required" | "cancelled";

export function evaluateFleetUpdateCandidate(input: {
  manifest: SignedUpdateManifest;
  publicKeyPem: string;
  hardwareModel: string | null;
  installedVersion: string | null;
}, now = new Date()): { eligible: boolean; reason: string; manifestDigest: string | null } {
  const signed = verifyUpdateManifest(input.manifest, input.publicKeyPem, now);
  if (!signed.eligible) return signed;
  if (!input.hardwareModel || !input.manifest.hardwareModels?.includes(input.hardwareModel)) return { eligible: false, reason: "hardware_incompatible", manifestDigest: null };
  if (!input.installedVersion || !valid(input.installedVersion) || !gt(input.manifest.version, input.installedVersion)) return { eligible: false, reason: "version_not_newer", manifestDigest: null };
  return { eligible: true, reason: "signed_compatible_update_no_install_performed", manifestDigest: signed.manifestDigest };
}

const nextStates: Record<FleetUpdateState, readonly FleetUpdateState[]> = {
  scheduled: ["downloading", "cancelled", "failed"],
  downloading: ["verifying", "failed", "cancelled"],
  verifying: ["installing", "failed", "cancelled"],
  installing: ["restarting", "failed", "recovery_required"],
  restarting: ["health_check", "failed", "recovery_required"],
  health_check: ["succeeded", "failed", "recovery_required", "rolled_back"],
  succeeded: [],
  failed: ["recovery_required", "rolled_back"],
  rolled_back: [],
  recovery_required: ["rolled_back"],
  cancelled: [],
};

export function canAdvanceFleetUpdate(input: {
  current: FleetUpdateState;
  next: FleetUpdateState;
  manifestVerified: boolean;
  postUpdateHealthVerified: boolean;
  rollbackVerified: boolean;
}): boolean {
  if (!nextStates[input.current].includes(input.next)) return false;
  if (["installing", "restarting", "health_check", "succeeded"].includes(input.next) && !input.manifestVerified) return false;
  if (input.next === "succeeded" && !input.postUpdateHealthVerified) return false;
  if (input.next === "rolled_back" && !input.rollbackVerified) return false;
  return true;
}