import dns from "node:dns/promises";
import net from "node:net";

const PRIVATE_IPV4_RANGES = [
  { from: "10.0.0.0", to: "10.255.255.255" },
  { from: "127.0.0.0", to: "127.255.255.255" },
  { from: "169.254.0.0", to: "169.254.255.255" },
  { from: "172.16.0.0", to: "172.31.255.255" },
  { from: "192.168.0.0", to: "192.168.255.255" },
  { from: "0.0.0.0", to: "0.255.255.255" },
] as const;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function ipv4ToLong(ip: string) {
  return ip
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function isPrivateIpv4(ip: string) {
  const numeric = ipv4ToLong(ip);

  return PRIVATE_IPV4_RANGES.some((range) => {
    const from = ipv4ToLong(range.from);
    const to = ipv4ToLong(range.to);

    return numeric >= from && numeric <= to;
  });
}

function isBlockedIpv6(ip: string) {
  const normalized = ip.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized === "::"
  );
}

export function assertPublicHttpUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL is invalid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (!parsed.hostname || BLOCKED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new Error("Hostname is not allowed.");
  }

  const hostnameIpFamily = net.isIP(parsed.hostname);

  if (hostnameIpFamily === 4 && isPrivateIpv4(parsed.hostname)) {
    throw new Error("Private-network destination is not allowed.");
  }

  if (hostnameIpFamily === 6 && isBlockedIpv6(parsed.hostname)) {
    throw new Error("Private-network destination is not allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentialed URLs are not allowed.");
  }

  if (parsed.protocol === "http:" && parsed.port === "443") {
    throw new Error("URL protocol and port combination is invalid.");
  }

  if (parsed.protocol === "https:" && parsed.port === "80") {
    throw new Error("URL protocol and port combination is invalid.");
  }

  return parsed;
}

export async function assertHostnameResolvesToPublicIp(hostname: string) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });

  if (records.length === 0) {
    throw new Error("Host did not resolve to an address.");
  }

  for (const record of records) {
    if (record.family === 4 && isPrivateIpv4(record.address)) {
      throw new Error("Private-network destination is not allowed.");
    }

    if (record.family === 6 && isBlockedIpv6(record.address)) {
      throw new Error("Private-network destination is not allowed.");
    }

    if (net.isIP(record.address) === 0) {
      throw new Error("Invalid resolved IP address.");
    }
  }
}

type SafeFetchOptions = {
  timeoutMs: number;
  maxRedirects: number;
  userAgent: string;
  accept?: string;
};

export async function fetchWithSafeRedirects(url: URL, options: SafeFetchOptions) {
  let current = new URL(url.toString());

  for (let redirectCount = 0; redirectCount <= options.maxRedirects; redirectCount += 1) {
    assertPublicHttpUrl(current.toString());
    await assertHostnameResolvesToPublicIp(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": options.userAgent,
          Accept: options.accept ?? "*/*",
        },
        signal: controller.signal,
      });

      const isRedirect = response.status >= 300 && response.status < 400;

      if (!isRedirect) {
        return response;
      }

      const location = response.headers.get("location");

      if (!location) {
        throw new Error("Redirect response was missing a location header.");
      }

      current = new URL(location, current);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Too many redirects.");
}

export async function readResponseWithinLimit(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();

  if (!reader) {
    return new Uint8Array(0);
  }

  let total = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    total += result.value.byteLength;

    if (total > maxBytes) {
      throw new Error("Response exceeded maximum allowed size.");
    }

    chunks.push(result.value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}
