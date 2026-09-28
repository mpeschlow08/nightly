import { createConnection, type Socket } from "node:net";

export type RtspProbeState = "not_tested" | "candidate" | "reachable" | "authentication_required" | "stream_validated" | "timeout" | "unreachable" | "invalid_endpoint";

export type RtspProbeResult = {
  state: RtspProbeState;
  endpoint: string | null;
  configured: boolean;
  authenticated: false;
  statusCode: number | null;
  checkedAt: string;
  streamValidated: false;
  evidence: { method: "OPTIONS" | null; reason: string };
};

export type RtspProbeOptions = {
  timeoutMs?: number;
  configured?: boolean;
  socketFactory?: (options: { host: string; port: number }) => Socket;
  now?: () => Date;
};

export function parseRtspCandidate(endpoint: string) {
  if (endpoint.length > 2048 || /[\u0000-\u001f\u007f]/.test(endpoint)) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "rtsp:" || url.username || url.password || url.hash) return null;
    const port = url.port ? Number(url.port) : 554;
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!host || host.length > 253) return null;
    url.search = "";
    url.hash = "";
    return { host, port, requestTarget: url.pathname || "/", endpoint: `rtsp://${host.includes(":") ? `[${host}]` : host}:${port}` };
  } catch {
    return null;
  }
}

export function createRtspCandidate(endpoint: string, configured = false, now = new Date()): RtspProbeResult {
  const candidate = parseRtspCandidate(endpoint);
  return {
    state: candidate ? "candidate" : "invalid_endpoint",
    endpoint: candidate?.endpoint ?? null,
    configured,
    authenticated: false,
    statusCode: null,
    checkedAt: now.toISOString(),
    streamValidated: false,
    evidence: { method: null, reason: candidate ? "credential_free_rtsp_candidate_not_probed" : "endpoint_must_be_credential_free_rtsp" },
  };
}

export async function probeRtspEndpoint(endpoint: string, options: RtspProbeOptions = {}): Promise<RtspProbeResult> {
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const candidate = parseRtspCandidate(endpoint);
  if (!candidate) return { ...createRtspCandidate(endpoint, options.configured, options.now?.() ?? new Date()), state: "invalid_endpoint" };
  const timeoutMs = options.timeoutMs ?? 2_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5_000) throw new Error("RTSP probe timeout must be between 100ms and 5s.");
  const connect = options.socketFactory ?? ((connection) => createConnection(connection));

  return new Promise<RtspProbeResult>((resolve) => {
    const socket = connect({ host: candidate.host, port: candidate.port });
    let complete = false;
    let buffer = "";
    const done = (state: RtspProbeState, statusCode: number | null, reason: string) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.destroy();
      resolve({ state, endpoint: candidate.endpoint, configured: options.configured ?? false, authenticated: false, statusCode, checkedAt, streamValidated: false, evidence: { method: state === "candidate" ? null : "OPTIONS", reason } });
    };
    const timer = setTimeout(() => done("timeout", null, "probe_timeout"), timeoutMs);
    socket.setTimeout(timeoutMs, () => done("timeout", null, "socket_timeout"));
    socket.once("connect", () => {
      socket.write(`OPTIONS ${candidate.requestTarget} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Nightly-Agent\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      if (buffer.length > 8192) { done("unreachable", null, "response_too_large"); return; }
      const line = buffer.match(/^RTSP\/1\.[01]\s+(\d{3})(?:\s|$)/m);
      if (!line) return;
      const statusCode = Number(line[1]);
      if (statusCode === 401 || statusCode === 407) done("authentication_required", statusCode, "server_requires_authorization");
      else if (statusCode >= 200 && statusCode < 300) done("reachable", statusCode, "valid_rtsp_options_response_stream_not_validated");
      else done("unreachable", statusCode, "rtsp_options_rejected");
    });
    socket.once("error", () => done("unreachable", null, "connection_failed"));
    socket.once("close", () => { if (!complete) done("unreachable", null, "connection_closed_before_rtsp_response"); });
  });
}