import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import { test } from "node:test";
import { authenticatedMediaInput, probeMedia, startCapture } from "../src/media/engine";
import type { AuthorizedMediaSource, MediaPolicy } from "../src/media/contracts";

const user = "fixture-user";
const password = "fixture-password";
const credentials = Buffer.from(`${user}:${password}`).toString("base64");
const policy: MediaPolicy = { deviceId: 1, venueId: 2, serviceActive: true, contentEligible: true, hotReelEligible: true, publicPublishingEnabled: true, privacyRestricted: false, masksApplied: false };

async function rtspFixture() {
  const sockets = new Set<Socket>();
  const intervals = new Set<NodeJS.Timeout>();
  let authorized = 0;
  let denied = 0;
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    let pending = "";
    socket.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      while (pending.includes("\r\n\r\n")) {
        const end = pending.indexOf("\r\n\r\n") + 4;
        const request = pending.slice(0, end);
        pending = pending.slice(end);
        const method = request.split(" ")[0];
        const sequence = /\r\nCSeq: (\d+)/i.exec(request)?.[1] ?? "1";
        const valid = request.split("\r\n").some((line) => line === `Authorization: Basic ${credentials}`);
        if (valid) authorized++;
        else denied++;
        const reply = (status: string, extra = "", body = "") => {
          if (!socket.destroyed) socket.write(`RTSP/1.0 ${status}\r\nCSeq: ${sequence}\r\n${extra}Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
        };
        if (!valid) { reply("401 Unauthorized", 'WWW-Authenticate: Basic realm="nightly-fixture"\r\n'); continue; }
        if (method === "DESCRIBE") {
          const sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=Nightly fixture\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\na=control:*\r\nm=audio 0 RTP/AVP 0\r\na=control:trackID=0\r\n";
          reply("200 OK", "Content-Type: application/sdp\r\n", sdp);
        } else if (method === "SETUP") reply("200 OK", "Session: 1\r\nTransport: RTP/AVP/TCP;unicast;interleaved=0-1\r\n");
        else if (method === "PLAY") {
          reply("200 OK", "Session: 1\r\n");
          let sequenceNumber = 0;
          const interval = setInterval(() => {
            if (sequenceNumber >= 400 || socket.destroyed) { clearInterval(interval); intervals.delete(interval); return; }
            const rtp = Buffer.alloc(172, 0xff);
            rtp[0] = 0x80; rtp[1] = 0; rtp.writeUInt16BE(sequenceNumber, 2); rtp.writeUInt32BE(sequenceNumber * 160, 4); rtp.writeUInt32BE(1, 8);
            const frame = Buffer.alloc(4); frame[0] = 0x24; frame[1] = 0; frame.writeUInt16BE(rtp.length, 2);
            socket.write(Buffer.concat([frame, rtp]));
            sequenceNumber++;
          }, 12);
          intervals.add(interval);
        } else reply("200 OK", method === "TEARDOWN" ? "Session: 1\r\n" : "");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const source: AuthorizedMediaSource = { deviceId: 1, venueId: 2, sourceId: 3, venueCameraId: 4, kind: "IP_CAMERA", audioRole: "CAMERA_AUDIO", active: true, locator: `rtsp://127.0.0.1:${port}/live`, privacyMasksRequired: false };
  return { source, get authorized() { return authorized; }, get denied() { return denied; }, close: async () => {
    for (const interval of intervals) clearInterval(interval);
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } };
}

test("Linux FFmpeg and ffprobe authenticate RTSP via short-lived per-source URL", { skip: process.platform !== "linux", timeout: 20_000 }, async () => {
  const fixture = await rtspFixture();
  const expiry = () => new Date(Date.now() + 30_000).toISOString();
  const response = (pass: string) => ({ sourceId: 3, configRevision: "r1", streamUrl: `rtsp://${user}:${pass}@127.0.0.1:${new URL(fixture.source.locator).port}/live`, expiresAt: expiry() });
  try {
    await assert.rejects(probeMedia(fixture.source, policy, undefined, { probeMs: 3000 }), /media_probe_failed/);
    const wrong = authenticatedMediaInput(fixture.source, response("wrong-password"), "r1");
    await assert.rejects(probeMedia(fixture.source, policy, undefined, { probeMs: 3000 }, wrong), /media_probe_failed/);
    const auth = authenticatedMediaInput(fixture.source, response(password), "r1");
    assert.equal(auth.input.locator, fixture.source.locator);
    const capabilities = await probeMedia(fixture.source, policy, undefined, { probeMs: 3000 }, auth);
    assert.equal(capabilities.audio?.codec, "pcm_mulaw");
    let received = 0;
    const capture = await startCapture(fixture.source, policy, { startupMs: 6000, resolveStream: async () => response(password), configRevision: "r1", onSegment: (segment) => {
      assert.equal(segment.sequence, received);
      assert.ok(segment.bytes.length >= 188);
      assert.equal(segment.bytes[0], 0x47);
      received++;
    } });
    try { assert.ok(received > 0); }
    finally { await capture.stop(); }
    assert.ok(fixture.authorized > 0 && fixture.denied > 0);
    assert.ok(!JSON.stringify(capabilities).includes(password));
    console.log(JSON.stringify({ rtspBasic: "PASS", unauthenticatedDenied: true, incorrectPasswordDenied: true, ffprobeAuthenticated: true, ffmpegSegmentDelivered: received > 0, captureStopped: true }));
  } finally { await fixture.close(); }
});