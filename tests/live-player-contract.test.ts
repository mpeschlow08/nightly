import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const playerPath = "components/live/LiveVenueStreamClient.tsx";

function source() {
  return readFileSync(playerPath, "utf8");
}

test("player uses bounded retry and cleanup lifecycle", () => {
  const content = source();

  assert.ok(content.includes("MAX_OFFLINE_RETRIES"));
  assert.ok(content.includes("OFFLINE_RETRY_INTERVAL_MS"));
  assert.ok(content.includes("clearTimeout(timer)"));
  assert.ok(content.includes("hls.destroy()"));
  assert.ok(content.includes("video.removeAttribute(\"src\")"));
});

test("player input contract remains safe and does not consume ingest secrets", () => {
  const content = source();

  assert.equal(content.includes("streamUrl"), false);
  assert.equal(content.includes("rtsp://"), false);
  assert.equal(content.includes("CLOUDFLARE_STREAM_API_TOKEN"), false);
  assert.equal(content.includes("providerLiveInputId"), false);
  assert.equal(content.includes("ingest"), false);
});

test("player does not force autoplay with audio", () => {
  const content = source();

  assert.equal(content.includes("autoPlay"), false);
  assert.ok(content.includes("muted"));
  assert.ok(content.includes("playsInline"));
});
