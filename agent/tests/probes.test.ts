import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { lookup } from "node:dns/promises";
import type { Socket as DgramSocket } from "node:dgram";
import type { Socket as NetSocket } from "node:net";
import { buildOnvifProbeMessage, OnvifDiscoveryClient, ONVIF_MAX_RESPONSE_BYTES, parseOnvifProbeMatches } from "../src/probes/onvif-discovery";
import { createRtspCandidate, parseRtspCandidate, probeRtspEndpoint } from "../src/probes/rtsp";
import { parseVaInfo, probeLinuxHardware } from "../src/probes/linux-hardware";
import { LinuxProbeAdapter } from "../src/probes/linux";
import type { AgentConfig } from "../src/core/types";

const onvifReply = (address = "urn:uuid:12345678-1234-1234-1234-123456789abc", xaddrs = "http://192.168.1.20/onvif/device_service") =>
  `<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"><e:Body><d:ProbeMatches><d:ProbeMatch><w:EndpointReference><w:Address>${address}</w:Address></w:EndpointReference><d:Types>dn:NetworkVideoTransmitter</d:Types><d:Scopes>onvif://www.onvif.org/type/video_encoder</d:Scopes><d:XAddrs>${xaddrs}</d:XAddrs></d:ProbeMatch></d:ProbeMatches></e:Body></e:Envelope>`;

class FakeDgramSocket extends EventEmitter {
  sent: Buffer | null = null;
  closed = false;
  bind(_port: number, _address: string | undefined, callback: () => void) { queueMicrotask(callback); }
  setMulticastTTL(_ttl: number) {}
  addMembership(_address: string, _interfaceAddress?: string) {}
  send(message: Buffer, _port: number, _address: string, callback: (error: Error | null) => void) { this.sent = message; callback(null); }
  close() { this.closed = true; }
}

class FakeNetSocket extends EventEmitter {
  requests: string[] = [];
  destroyed = false;
  response: string | null = "RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS, DESCRIBE\r\n\r\n";
  setTimeout(_timeout: number, _callback?: () => void) {}
  write(value: string) { this.requests.push(value); if (this.response) queueMicrotask(() => this.emit("data", Buffer.from(this.response!))); return true; }
  destroy() { this.destroyed = true; }
}

test("WS-Discovery Probe uses ONVIF NetworkVideoTransmitter scopes and a unique ID", () => {
  const xml = buildOnvifProbeMessage("urn:uuid:12345678-1234-1234-1234-123456789abc");
  assert.match(xml, /schemas-xmlsoap-org:ws:2005:04:discovery/);
  assert.match(xml, /NetworkVideoTransmitter/);
  assert.match(xml, /urn:uuid:12345678-1234-1234-1234-123456789abc/);
  assert.throws(() => buildOnvifProbeMessage("bad-id"), /Invalid WS-Discovery/);
});

test("ONVIF parser bounds responses and returns safe discovery identity", () => {
  const devices = parseOnvifProbeMatches(onvifReply(), "192.168.1.20", new Date("2026-09-27T00:00:00.000Z"));
  assert.equal(devices.length, 1);
  assert.equal(devices[0]?.sourceAddress, "192.168.1.20");
  assert.deepEqual(devices[0]?.xaddrs, ["http://192.168.1.20/onvif/device_service"]);
  assert.equal(devices[0]?.endpointReference, "urn:uuid:12345678-1234-1234-1234-123456789abc");
  assert.throws(() => parseOnvifProbeMatches(Buffer.alloc(ONVIF_MAX_RESPONSE_BYTES + 1), "192.168.1.20"), /size/);
  assert.throws(() => parseOnvifProbeMatches("<!DOCTYPE x [<!ENTITY a SYSTEM 'file:///etc/passwd'>]><x>&a;</x>", "192.168.1.20"), /disallowed/);
  assert.throws(() => parseOnvifProbeMatches("<broken", "192.168.1.20"));
});

test("ONVIF parser rejects credentialed XAddrs and never returns credentials", () => {
  const devices = parseOnvifProbeMatches(onvifReply(undefined, "http://camera:secret@192.168.1.20/onvif?token=private"), "192.168.1.20");
  assert.equal(devices.length, 0);
  assert.equal(JSON.stringify(devices).includes("secret"), false);
  assert.equal(JSON.stringify(devices).includes("token"), false);
});

test("ONVIF discovery sends one bounded multicast probe and deduplicates replies", async () => {
  const socket = new FakeDgramSocket();
  const client = new OnvifDiscoveryClient(() => socket as unknown as DgramSocket, () => buildOnvifProbeMessage("urn:uuid:12345678-1234-1234-1234-123456789abc"));
  const pending = client.discover({ durationMs: 120, interfaceAddress: "192.168.1.2" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(socket.sent?.toString() ?? "", /NetworkVideoTransmitter/);
  socket.emit("message", Buffer.from(onvifReply()), { address: "192.168.1.20" });
  socket.emit("message", Buffer.from(onvifReply()), { address: "192.168.1.21" });
  const result = await pending;
  assert.equal(result.devices.length, 1);
  assert.equal(result.devices[0]?.sourceAddress, "192.168.1.20");
  assert.equal(socket.closed, true);
});

test("ONVIF discovery rejects malformed input options and supports abort/timeout", async () => {
  await assert.rejects(new OnvifDiscoveryClient().discover({ durationMs: 20 }), /duration/);
  const abortedSocket = new FakeDgramSocket();
  const controller = new AbortController();
  const aborted = new OnvifDiscoveryClient(() => abortedSocket as unknown as DgramSocket).discover({ durationMs: 1_000, signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(aborted, { name: "AbortError" });
  const timedSocket = new FakeDgramSocket();
  const started = Date.now();
  const timeoutResult = await new OnvifDiscoveryClient(() => timedSocket as unknown as DgramSocket).discover({ durationMs: 100 });
  assert.equal(timeoutResult.devices.length, 0);
  assert.ok(Date.now() - started < 1_000);
});

test("RTSP candidate parsing rejects credentials and the reachability probe never validates a stream", async () => {
  const credentialedEndpoint = ["rtsp://user:", "pass", "word@camera.local/live"].join("");
  assert.equal(parseRtspCandidate(credentialedEndpoint), null);
  const candidate = createRtspCandidate("rtsp://camera.local/live", true);
  assert.equal(candidate.state, "candidate");
  assert.equal(candidate.configured, true);
  assert.equal(candidate.authenticated, false);
  assert.equal(candidate.streamValidated, false);
  const tokenPath = createRtspCandidate("rtsp://camera.local/stream/token-secret-value?api_key=must-not-return");
  assert.equal(JSON.stringify(tokenPath).includes("token-secret-value"), false);
  assert.equal(JSON.stringify(tokenPath).includes("must-not-return"), false);
  const socket = new FakeNetSocket();
  const result = await probeRtspEndpoint("rtsp://192.168.1.20/live", { socketFactory: () => {
    queueMicrotask(() => socket.emit("connect"));
    return socket as unknown as NetSocket;
  } });
  assert.equal(result.state, "reachable");
  assert.equal(result.streamValidated, false);
  assert.equal(result.authenticated, false);
  assert.equal(result.endpoint, "rtsp://192.168.1.20:554");
  assert.equal(socket.requests.length, 1);
  assert.match(socket.requests[0] ?? "", /^OPTIONS \/live RTSP\/1\.0/m);
  assert.equal(socket.requests.join("").includes("password"), false);
});

test("RTSP distinguishes authentication, timeout, and invalid endpoints without retries", async () => {
  const authSocket = new FakeNetSocket();
  authSocket.response = "RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\n\r\n";
  const auth = await probeRtspEndpoint("rtsp://camera.local/live", { socketFactory: () => {
    queueMicrotask(() => authSocket.emit("connect"));
    return authSocket as unknown as NetSocket;
  } });
  assert.equal(auth.state, "authentication_required");
  assert.equal(authSocket.requests.length, 1);
  assert.equal((await probeRtspEndpoint("http://camera.local/live")).state, "invalid_endpoint");

  const silent = new FakeNetSocket();
  silent.response = null;
  const timeout = await probeRtspEndpoint("rtsp://camera.local/live", { timeoutMs: 100, socketFactory: () => {
    queueMicrotask(() => silent.emit("connect"));
    return silent as unknown as NetSocket;
  } });
  assert.equal(timeout.state, "timeout");
  assert.equal(silent.requests.length, 1);
});

const vaInfo = [
  "VAProfileH264High : VAEntrypointVLD",
  "VAProfileH264High : VAEntrypointEncSlice",
  "VAProfileHEVCMain : VAEntrypointVLD",
  "VAProfileHEVCMain : VAEntrypointEncSlice",
].join("\n");

test("VA-API parser requires profile and encode entrypoint for each codec", () => {
  const parsed = parseVaInfo(vaInfo);
  assert.equal(parsed.h264Encode, true);
  assert.equal(parsed.hevcEncode, true);
  assert.equal(parseVaInfo("VAProfileH264High : VAEntrypointVLD").h264Encode, false);
  assert.equal(parseVaInfo("VAProfileH264High : VAEntrypointVLD\nVAProfileHEVCMain : VAEntrypointEncSlice").h264Encode, false);
  assert.equal(parseVaInfo("VAProfileH264High\nVAEntrypointEncSlice").h264Encode, false);
  assert.equal(parseVaInfo("vainfo failed").availability, "NOT_TESTED");
});

test("Linux probe requires vainfo evidence and never infers HDMI or balanced audio capability", async () => {
  const base = await probeLinuxHardware({
    platform: "linux",
    readDirectory: async (path) => path === "/dev" ? ["video0"] : path === "/dev/dri" ? ["renderD128"] : path === "/sys/class/drm" ? ["card0"] : [],
    readText: async (path) => path.endsWith("/vendor") ? "0x8086" : path === "/proc/asound/cards" ? " 0 [USB            ]: USB-Audio - USB Audio\n" : "",
    run: async () => vaInfo,
  });
  assert.equal(base.video.availability, "SUPPORTED");
  assert.equal(base.video.captureProven, false);
  assert.equal(base.audio.availability, "SUPPORTED");
  assert.equal(base.audio.balancedLineInputProven, false);
  assert.equal(base.acceleration.intelGpuPresent, true);
  assert.equal(base.acceleration.h264Encode, true);
  assert.equal(base.acceleration.hevcEncode, true);
  assert.equal(base.acceleration.qsv, "NOT_TESTED");

  const missing = await probeLinuxHardware({
    platform: "linux",
    readDirectory: async (path) => path === "/dev/dri" ? ["renderD128"] : path === "/sys/class/drm" ? ["card0"] : [],
    readText: async (path) => path.endsWith("/vendor") ? "0x8086" : "",
    run: async () => { throw Object.assign(new Error("not installed"), { code: "ENOENT" }); },
  });
  assert.equal(missing.acceleration.vaapi, "NOT_AVAILABLE");
  assert.equal(missing.acceleration.h264Encode, null);
});

test("Windows reports Linux hardware as unsupported rather than simulated success", async () => {
  const result = await probeLinuxHardware({ platform: "win32" });
  assert.equal(result.video.availability, "UNSUPPORTED");
  assert.equal(result.audio.availability, "UNSUPPORTED");
  assert.equal(result.acceleration.availability, "UNSUPPORTED");
});

test("Agent platform snapshot reports ONVIF discovery without claiming capture is validated", async () => {
  const config: AgentConfig = {
    controlPlaneUrl: "https://control.example.test",
    deviceUuid: "device-uuid",
    serialNumber: "serial-123",
    agentVersion: "0.1.0",
    heartbeatIntervalMs: 30_000,
    requestTimeoutMs: 1_000,
    retryBaseMs: 100,
    retryMaxMs: 1_000,
    stateDirectory: "C:/state",
    sourceDiscoveryWindowMs: 500,
    simulation: false,
  };
  const onvifClient = {
    discover: async () => ({
      devices: [{ endpointReference: "urn:uuid:12345678-1234-1234-1234-123456789abc", xaddrs: ["http://192.168.1.20/onvif/device_service"], sourceAddress: "192.168.1.20", types: ["NetworkVideoTransmitter"], scopes: [], discoveredAt: new Date().toISOString() }],
      malformedResponses: 0,
      oversizedResponses: 0,
    }),
  } as unknown as OnvifDiscoveryClient;
  const resolver = (async () => [{ address: "127.0.0.1", family: 4 }]) as unknown as typeof lookup;
  const adapter = new LinuxProbeAdapter(
    resolver,
    { platform: "linux", readDirectory: async () => [], readText: async () => "", run: async () => "" },
    onvifClient,
  );
  const snapshot = await adapter.discover(config);
  const cameraCheck = snapshot.commissioning.checks.find((check) => check.checkKey === "cameras");
  assert.equal(snapshot.availability.cameras, "SUPPORTED");
  assert.equal(cameraCheck?.status, "not_tested");
  assert.equal(snapshot.inventory.sources.length, 0);
  assert.equal(snapshot.capabilities.capabilities.find((capability) => capability.category === "onvif")?.value, 1);
  assert.equal(snapshot.onvifDevices[0]?.sourceAddress, "192.168.1.20");
  assert.deepEqual(snapshot.onvifDevices[0]?.xaddrs, ["http://192.168.1.20/onvif/device_service"]);
});

test("systemd unit includes required hardware groups and bounded hardened service settings", async () => {
  const unit = await readFile(join(__dirname, "../systemd/nightly-agent.service"), "utf8");
  const settings = new Map(unit.split(/\r?\n/).filter((line) => line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  assert.equal(settings.get("User"), "nightly-agent");
  assert.equal(settings.get("SupplementaryGroups"), "video audio render");
  assert.equal(settings.get("Restart"), "on-failure");
  assert.equal(settings.get("RestartSec"), "5s");
  assert.equal(settings.get("WatchdogSec"), "90s");
  assert.equal(settings.get("WorkingDirectory"), "/opt/nightly-agent/current/agent");
  assert.equal(settings.get("ProtectSystem"), "strict");
  assert.equal(settings.get("NoNewPrivileges"), "true");
  assert.equal(settings.get("StateDirectoryMode"), "0700");
  assert.equal(settings.get("PrivateDevices"), undefined);
  assert.match(unit, /EnvironmentFile=-\/etc\/nightly-agent\/agent\.env/);
  assert.match(unit, /LoadCredential=credential-key:/);
});