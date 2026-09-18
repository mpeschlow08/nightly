import assert from "node:assert/strict";
import test from "node:test";

import { maskCameraSourceUrl } from "@/lib/live/source-sanitizer";

test("masks credentialed RTSP source without leaking password", () => {
  const input = "rtsp://nightlyuser:SuperSecret123@192.168.1.50/live";
  const masked = maskCameraSourceUrl(input);

  assert.ok(masked.startsWith("rtsp://nightlyuser:"));
  assert.ok(masked.includes("@192.168.1.50/live"));
  assert.equal(masked.includes("SuperSecret123"), false);
});

test("keeps RTSP without credentials unchanged", () => {
  const input = "rtsp://192.168.1.50/live";
  assert.equal(maskCameraSourceUrl(input), input);
});

test("masks tokenized query strings", () => {
  const input = "https://cdn.example.com/live/manifest.m3u8?token=abc123&foo=bar";
  const masked = maskCameraSourceUrl(input);

  assert.equal(masked.includes("abc123"), false);
  assert.ok(masked.includes("token=%5BREDACTED%5D"));
  assert.ok(masked.includes("foo=bar"));
});

test("handles malformed source with embedded credentials", () => {
  const input = "rtsp://nightlyuser:SuperSecret123@camera-host/live path";
  const masked = maskCameraSourceUrl(input);
  assert.equal(masked.includes("SuperSecret123"), false);
});

test("returns empty string for empty source", () => {
  assert.equal(maskCameraSourceUrl("   "), "");
});
