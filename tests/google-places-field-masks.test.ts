import assert from "node:assert/strict";
import test from "node:test";

import {
  GOOGLE_PLACE_DETAILS_FIELDS,
  GOOGLE_PLACES_FIELD_MASKS,
  GOOGLE_TEXT_SEARCH_FIELDS,
} from "@/app/owner/lib/google-places";

test("field masks are explicit and do not use wildcard", () => {
  assert.equal(GOOGLE_TEXT_SEARCH_FIELDS.includes("*"), false);
  assert.equal(GOOGLE_PLACE_DETAILS_FIELDS.includes("*"), false);

  for (const value of Object.values(GOOGLE_PLACES_FIELD_MASKS)) {
    assert.equal(value.includes("*"), false);
    assert.equal(value.trim().length > 0, true);
  }
});

test("details field mask includes core profiles", () => {
  assert.equal(
    GOOGLE_PLACE_DETAILS_FIELDS.includes("businessStatus"),
    true,
    "Expected venue identity fields in details mask"
  );
  assert.equal(
    GOOGLE_PLACE_DETAILS_FIELDS.includes("currentOpeningHours"),
    true,
    "Expected hours fields in details mask"
  );
  assert.equal(
    GOOGLE_PLACE_DETAILS_FIELDS.includes("photos"),
    true,
    "Expected imagery fields in details mask"
  );
});
