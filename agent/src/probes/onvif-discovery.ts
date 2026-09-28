import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { createSocket, type Socket } from "node:dgram";
import { XMLParser } from "fast-xml-parser";

export const ONVIF_MULTICAST_ADDRESS = "239.255.255.250";
export const ONVIF_DISCOVERY_PORT = 3702;
export const ONVIF_MAX_RESPONSE_BYTES = 16 * 1024;
export const ONVIF_MAX_RESULTS = 64;

export type OnvifDevice = {
  endpointReference: string | null;
  xaddrs: string[];
  sourceAddress: string;
  types: string[];
  scopes: string[];
  discoveredAt: string;
};

export type OnvifDiscoveryOptions = {
  durationMs?: number;
  interfaceAddress?: string;
  multicastAddress?: string;
  port?: number;
  signal?: AbortSignal;
};

export type OnvifDiscoveryResult = {
  devices: OnvifDevice[];
  malformedResponses: number;
  oversizedResponses: number;
};

type SocketFactory = () => Socket;
type ProbeMessageFactory = () => string;
type Clock = () => Date;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  processEntities: false,
  htmlEntities: false,
  allowBooleanAttributes: false,
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
  maxNestedTags: 32,
  unpairedTags: [],
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function child(node: Record<string, unknown>, name: string): unknown {
  const key = Object.keys(node).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? node[key] : undefined;
}

function scalarText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!isRecord(value)) return null;
  const text = value["#text"];
  return typeof text === "string" ? text.trim() || null : null;
}

function findNodes(value: unknown, name: string, output: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const entry of value) findNodes(entry, name, output);
  } else if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (key.toLowerCase() === name.toLowerCase()) {
        if (Array.isArray(entry)) {
          for (const item of entry) if (isRecord(item)) output.push(item);
        } else if (isRecord(entry)) {
          output.push(entry);
        }
      }
      if (key !== "#text") findNodes(entry, name, output);
    }
  }
  return output;
}

function words(value: unknown, maxCount: number): string[] {
  const text = scalarText(value);
  if (!text || text.length > 4096) return [];
  return [...new Set(text.split(/\s+/).filter((item) => item.length > 0 && item.length <= 512 && !/secret|password|token|credential|authorization/i.test(item)))].slice(0, maxCount);
}

function safeXAddr(value: string): string | null {
  if (value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, 1024);
  } catch {
    return null;
  }
}

function safeEndpointReference(value: unknown): string | null {
  const address = scalarText(value);
  if (!address || address.length > 256 || /[\u0000-\u0020\u007f]/.test(address) || /secret|password|token|credential|authorization/i.test(address)) return null;
  try {
    const url = new URL(address);
    if (url.username || url.password) return null;
  } catch {
    if (!/^(?:urn:uuid:|uuid:)[0-9a-f-]{8,64}$/i.test(address)) return null;
  }
  return address;
}

export function buildOnvifProbeMessage(messageId = `urn:uuid:${randomUUID()}`) {
  if (messageId.length > 128 || !/^urn:uuid:[0-9a-f-]{36}$/i.test(messageId)) throw new Error("Invalid WS-Discovery message ID.");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">` +
    `<e:Header><w:MessageID>${messageId}</w:MessageID><w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>` +
    `<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`;
}

export function parseOnvifProbeMatches(payload: Buffer | string, sourceAddress: string, now = new Date()): OnvifDevice[] {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
  if (bytes.byteLength === 0 || bytes.byteLength > ONVIF_MAX_RESPONSE_BYTES) throw new Error("ONVIF response size is invalid.");
  if (isIP(sourceAddress) === 0) throw new Error("ONVIF source address is invalid.");
  const xml = bytes.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)) throw new Error("ONVIF XML contains disallowed constructs.");

  const parsed: unknown = parser.parse(xml);
  if (!isRecord(parsed) || !child(parsed, "Envelope")) throw new Error("ONVIF SOAP envelope is invalid.");
  const matches = findNodes(parsed, "ProbeMatch").slice(0, ONVIF_MAX_RESULTS);
  const devices: OnvifDevice[] = [];
  for (const match of matches) {
    const endpointNode = child(match, "EndpointReference");
    const endpointReference = isRecord(endpointNode) ? safeEndpointReference(child(endpointNode, "Address")) : null;
    const xaddrsText = scalarText(child(match, "XAddrs")) ?? "";
    const xaddrs = [...new Set(xaddrsText.split(/\s+/).map(safeXAddr).filter((value): value is string => value !== null))].slice(0, 8);
    if (xaddrs.length === 0) continue;
    devices.push({
      endpointReference,
      xaddrs,
      sourceAddress,
      types: words(child(match, "Types"), 16),
      scopes: words(child(match, "Scopes"), 32),
      discoveredAt: now.toISOString(),
    });
  }
  return devices;
}

function dedupeKey(device: OnvifDevice) {
  return device.endpointReference?.toLowerCase() ?? `${device.sourceAddress}|${device.xaddrs.join("|").toLowerCase()}`;
}

function validateOptions(options: OnvifDiscoveryOptions) {
  const durationMs = options.durationMs ?? 3_000;
  const port = options.port ?? ONVIF_DISCOVERY_PORT;
  const multicastAddress = options.multicastAddress ?? ONVIF_MULTICAST_ADDRESS;
  if (!Number.isInteger(durationMs) || durationMs < 100 || durationMs > 10_000) throw new Error("ONVIF discovery duration must be between 100ms and 10s.");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("ONVIF discovery port is invalid.");
  const multicastParts = multicastAddress.split(".").map(Number);
  if (isIP(multicastAddress) !== 4 || multicastParts[0] < 224 || multicastParts[0] > 239) throw new Error("ONVIF multicast address must be IPv4 multicast.");
  if (options.interfaceAddress && isIP(options.interfaceAddress) !== 4) throw new Error("ONVIF interface address must be IPv4.");
  return { durationMs, port, multicastAddress };
}

export class OnvifDiscoveryClient {
  constructor(
    private readonly socketFactory: SocketFactory = () => createSocket("udp4"),
    private readonly messageFactory: ProbeMessageFactory = () => buildOnvifProbeMessage(),
    private readonly now: Clock = () => new Date(),
  ) {}

  async discover(options: OnvifDiscoveryOptions = {}): Promise<OnvifDiscoveryResult> {
    const normalized = validateOptions(options);
    if (options.signal?.aborted) throw new DOMException("ONVIF discovery aborted.", "AbortError");
    const socket = this.socketFactory();
    const devices = new Map<string, OnvifDevice>();
    let malformedResponses = 0;
    let oversizedResponses = 0;
    let timer: NodeJS.Timeout | undefined;

    return new Promise<OnvifDiscoveryResult>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        socket.removeAllListeners();
        try { socket.close(); } catch { /* Socket may already be closed. */ }
        if (error) reject(error);
        else resolve({ devices: [...devices.values()], malformedResponses, oversizedResponses });
      };
      const onAbort = () => finish(new DOMException("ONVIF discovery aborted.", "AbortError"));
      options.signal?.addEventListener("abort", onAbort, { once: true });
      socket.on("error", (error) => finish(error));
      socket.on("message", (message, remote) => {
        if (settled) return;
        if (message.byteLength > ONVIF_MAX_RESPONSE_BYTES) { oversizedResponses += 1; return; }
        try {
          for (const device of parseOnvifProbeMatches(message, remote.address, this.now())) {
            const key = dedupeKey(device);
            if (!devices.has(key) && devices.size < ONVIF_MAX_RESULTS) devices.set(key, device);
          }
        } catch {
          malformedResponses += 1;
        }
      });
      socket.bind(0, options.interfaceAddress, () => {
        if (settled) return;
        try {
          socket.setMulticastTTL(1);
          socket.addMembership(normalized.multicastAddress, options.interfaceAddress);
          timer = setTimeout(() => finish(), normalized.durationMs);
          const message = Buffer.from(this.messageFactory(), "utf8");
          socket.send(message, normalized.port, normalized.multicastAddress, (error) => { if (error) finish(error); });
        } catch (error) {
          finish(error instanceof Error ? error : new Error("ONVIF discovery setup failed."));
        }
      });
    });
  }
}