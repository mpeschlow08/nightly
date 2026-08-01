import assert from "node:assert/strict";
import test from "node:test";

import { resolveVenueField } from "@/app/lib/venue-field-resolution";

test("owner override wins over all sources", () => {
  const resolved = resolveVenueField({
    venue: {
      ownerOverrideFieldsJson: JSON.stringify(["phone"]),
      adminOverrideFieldsJson: JSON.stringify(["phone"]),
      googleDataLastFetchedAt: null,
      googleDataExpiresAt: null,
    },
    fieldKey: "phone",
    ownerValue: "+1 555 111 2222",
    adminValue: "+1 555 333 4444",
    googleValue: "+1 555 999 0000",
    importedValue: "+1 555 888 0000",
    fallbackValue: "N/A",
    googleAttributed: true,
  });

  assert.equal(resolved.source, "owner_override");
  assert.equal(resolved.value, "+1 555 111 2222");
  assert.equal(resolved.ownerOverride, true);
  assert.equal(resolved.attributionRequired, false);
});

test("admin override wins when owner override absent", () => {
  const resolved = resolveVenueField({
    venue: {
      ownerOverrideFieldsJson: JSON.stringify([]),
      adminOverrideFieldsJson: JSON.stringify(["websiteUrl"]),
      googleDataLastFetchedAt: null,
      googleDataExpiresAt: null,
    },
    fieldKey: "websiteUrl",
    ownerValue: "https://owner.example.com",
    adminValue: "https://admin.example.com",
    googleValue: "https://google.example.com",
    importedValue: "https://imported.example.com",
    fallbackValue: "https://fallback.example.com",
    googleAttributed: true,
  });

  assert.equal(resolved.source, "admin_override");
  assert.equal(resolved.value, "https://admin.example.com");
});

test("google source is marked stale when expiration is in the past", () => {
  const resolved = resolveVenueField({
    venue: {
      ownerOverrideFieldsJson: JSON.stringify([]),
      adminOverrideFieldsJson: JSON.stringify([]),
      googleDataLastFetchedAt: new Date("2026-01-01T00:00:00.000Z"),
      googleDataExpiresAt: new Date("2026-01-01T01:00:00.000Z"),
    },
    fieldKey: "address",
    ownerValue: null,
    adminValue: null,
    googleValue: "123 Main St",
    importedValue: "123 Main Street",
    fallbackValue: "Address unavailable",
    googleAttributed: true,
  });

  assert.equal(resolved.source, "google_places");
  assert.equal(resolved.stale, true);
  assert.equal(resolved.attributionRequired, true);
});

test("imported fallback is used when google and overrides are absent", () => {
  const resolved = resolveVenueField({
    venue: {
      ownerOverrideFieldsJson: JSON.stringify([]),
      adminOverrideFieldsJson: JSON.stringify([]),
      googleDataLastFetchedAt: null,
      googleDataExpiresAt: null,
    },
    fieldKey: "city",
    ownerValue: null,
    adminValue: null,
    googleValue: null,
    importedValue: "Atlanta",
    fallbackValue: "Unknown",
  });

  assert.equal(resolved.source, "imported");
  assert.equal(resolved.value, "Atlanta");
});
