import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("readiness includes camera live stream truth model service", () => {
  const content = readFileSync("lib/platform/readiness.ts", "utf8");

  assert.ok(content.includes("camera_live_streams"));
  assert.ok(content.includes("providerConfigured"));
  assert.ok(content.includes("provisioning"));
  assert.ok(content.includes("offline"));
  assert.ok(content.includes("error"));
  assert.ok(content.includes("disabled"));
});
