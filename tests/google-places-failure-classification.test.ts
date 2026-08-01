import assert from "node:assert/strict";
import test from "node:test";

import { classifyGooglePlacesFailure } from "@/app/owner/lib/google-places";

test("classifies invalid place id as permanent relink signal", () => {
  const result = classifyGooglePlacesFailure({
    httpStatus: 400,
    providerStatus: "INVALID_ARGUMENT",
    providerMessage: "The provided Place ID: abc is not valid.",
  });

  assert.equal(result.classification, "invalid_place_id");
  assert.equal(result.retryable, false);
});

test("classifies field mask issues as non-retryable", () => {
  const result = classifyGooglePlacesFailure({
    httpStatus: 400,
    providerStatus: "INVALID_ARGUMENT",
    providerMessage: "Invalid field mask.",
  });

  assert.equal(result.classification, "invalid_field_mask");
  assert.equal(result.retryable, false);
});

test("classifies throttling as retryable", () => {
  const result = classifyGooglePlacesFailure({
    httpStatus: 429,
    providerStatus: "RESOURCE_EXHAUSTED",
    providerMessage: "Quota exceeded.",
  });

  assert.equal(result.classification, "rate_limited");
  assert.equal(result.retryable, true);
});

test("classifies billing-related failures as configuration_required candidates", () => {
  const result = classifyGooglePlacesFailure({
    httpStatus: 403,
    providerStatus: "FAILED_PRECONDITION",
    providerMessage: "Please enable billing on the project.",
  });

  assert.equal(result.classification, "billing_required");
  assert.equal(result.retryable, false);
});
