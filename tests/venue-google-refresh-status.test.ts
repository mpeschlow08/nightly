import assert from "node:assert/strict";
import test from "node:test";

import {
  STALE_REFRESH_BLOCKED_STATUSES,
  classifyRefreshStatusFromFailure,
} from "@/lib/platform/venue-google-refresh-classification";

test("invalid place IDs require relink and are non-retry status", () => {
  const status = classifyRefreshStatusFromFailure("invalid_place_id", false);
  assert.equal(status, "relink_required");
});

test("permission failures map to configuration_required", () => {
  const status = classifyRefreshStatusFromFailure("permission_denied", false);
  assert.equal(status, "configuration_required");
});

test("transient provider failures map to retryable_failure", () => {
  const status = classifyRefreshStatusFromFailure("provider_5xx", true);
  assert.equal(status, "retryable_failure");
});

test("stale selection excludes permanent loop statuses", () => {
  assert.equal(STALE_REFRESH_BLOCKED_STATUSES.includes("relink_required"), true);
  assert.equal(STALE_REFRESH_BLOCKED_STATUSES.includes("configuration_required"), true);
  assert.equal(STALE_REFRESH_BLOCKED_STATUSES.includes("permanent_failure"), true);
  assert.equal(STALE_REFRESH_BLOCKED_STATUSES.includes("suspended"), true);
});
