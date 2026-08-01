import type { GooglePlacesFailureClassification } from "@/app/owner/lib/google-places";

export type VenueRefreshStatus =
  | "success"
  | "stale"
  | "pending"
  | "retryable_failure"
  | "permanent_failure"
  | "relink_required"
  | "configuration_required"
  | "suspended";

export const STALE_REFRESH_BLOCKED_STATUSES: VenueRefreshStatus[] = [
  "relink_required",
  "configuration_required",
  "permanent_failure",
  "suspended",
];

export function classifyRefreshStatusFromFailure(
  classification: GooglePlacesFailureClassification,
  retryable: boolean
): VenueRefreshStatus {
  if (
    classification === "invalid_place_id" ||
    classification === "place_not_found" ||
    classification === "place_moved"
  ) {
    return "relink_required";
  }

  if (classification === "permission_denied" || classification === "billing_required") {
    return "configuration_required";
  }

  if (
    classification === "place_closed" ||
    classification === "invalid_field_mask" ||
    classification === "unsupported_field" ||
    classification === "response_validation" ||
    classification === "provider_4xx"
  ) {
    return "permanent_failure";
  }

  return retryable ? "retryable_failure" : "permanent_failure";
}
