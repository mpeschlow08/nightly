import assert from "node:assert/strict";
import test from "node:test";
import { classifyMediaCertificationError } from "./helpers/media-certification-error";

test("media fixture diagnostics classify wrapped SQLSTATE without revealing fixture values", () => {
  const secret = "fixture-password-must-not-leak";
  const error = { message: secret, query: secret, params: [secret], cause: { code: "22P02", detail: secret } };
  const classified = classifyMediaCertificationError(error);
  assert.deepEqual(classified, { code: "22P02", constraint: null, category: "invalid_enum" });
  assert.doesNotMatch(JSON.stringify(classified), /fixture-password|query|params|detail/);
  assert.deepEqual(classifyMediaCertificationError({ cause: { code: "23503", constraint: "nightly_device_sources_camera_venue_fkey", detail: secret } }), {
    code: "23503", constraint: "nightly_device_sources_camera_venue_fkey", category: "foreign_key_violation",
  });
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.deepEqual(classifyMediaCertificationError(cyclic), { code: null, constraint: null, category: "unknown_database_error" });
});