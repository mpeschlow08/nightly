import {
  assertPublicHttpUrl,
  fetchWithSafeRedirects,
  readResponseWithinLimit,
} from "@/app/owner/lib/image-fetch-security";

export type WebsiteMetadata = {
  sourceUrl: string;
  finalUrl: string;
  title: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  twitterImageUrl: string | null;
  schemaLogoUrl: string | null;
  appleTouchIconUrl: string | null;
  faviconUrl: string | null;
  selectedImageUrl: string | null;
  selectedLogoUrl: string | null;
};

const HTML_FETCH_MAX_BYTES = 700 * 1024;
const WEBSITE_USER_AGENT = "NightlyBot/1.0 (+https://nightly.local)";

function textMatch(html: string, pattern: RegExp) {
  const match = pattern.exec(html);

  return match?.[1]?.trim() || null;
}

function extractMetaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );

  return textMatch(html, regex);
}

function extractLinkHref(html: string, relName: string) {
  const escaped = relName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>`,
    "i"
  );

  return textMatch(html, regex);
}

function extractSchemaLogoUrl(html: string) {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const payload = match[1]?.trim();

    if (!payload) {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as unknown;
      const candidate = extractLogoFromJsonLd(parsed);

      if (candidate) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractLogoFromJsonLd(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractLogoFromJsonLd(item);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const logo = record.logo;

  if (typeof logo === "string" && logo.trim()) {
    return logo.trim();
  }

  if (typeof logo === "object" && logo) {
    const imageObject = logo as Record<string, unknown>;

    if (typeof imageObject.url === "string" && imageObject.url.trim()) {
      return imageObject.url.trim();
    }
  }

  const graph = record["@graph"];

  if (graph) {
    return extractLogoFromJsonLd(graph);
  }

  return null;
}

export function resolveMetadataAssetUrl(baseUrl: URL, value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
    return null;
  }

  const resolved = new URL(trimmed, baseUrl);
  const checked = assertPublicHttpUrl(resolved.toString());

  if (checked.hostname === "localhost") {
    return null;
  }

  return checked.toString();
}

export async function fetchOfficialWebsiteMetadata(inputUrl: string): Promise<WebsiteMetadata> {
  const normalizedUrl = assertPublicHttpUrl(inputUrl).toString();
  const response = await fetchWithSafeRedirects(new URL(normalizedUrl), {
    timeoutMs: 7000,
    maxRedirects: 2,
    userAgent: WEBSITE_USER_AGENT,
    accept: "text/html,application/xhtml+xml",
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("text/html")) {
    throw new Error("Official website URL did not return HTML.");
  }

  const finalUrl = response.url || normalizedUrl;
  const htmlBytes = await readResponseWithinLimit(response, HTML_FETCH_MAX_BYTES);
  const html = new TextDecoder().decode(htmlBytes);
  const baseUrl = new URL(finalUrl);

  const title = textMatch(html, /<title[^>]*>([^<]+)<\/title>/i);
  const canonicalUrl = resolveMetadataAssetUrl(baseUrl, extractLinkHref(html, "canonical"));
  const ogImageUrl = resolveMetadataAssetUrl(baseUrl, extractMetaContent(html, "og:image"));
  const twitterImageUrl = resolveMetadataAssetUrl(baseUrl, extractMetaContent(html, "twitter:image"));
  const schemaLogoUrl = resolveMetadataAssetUrl(baseUrl, extractSchemaLogoUrl(html));
  const appleTouchIconUrl = resolveMetadataAssetUrl(baseUrl, extractLinkHref(html, "apple-touch-icon"));
  const faviconUrl =
    resolveMetadataAssetUrl(baseUrl, extractLinkHref(html, "shortcut icon")) ??
    resolveMetadataAssetUrl(baseUrl, extractLinkHref(html, "icon"));

  const selectedImageUrl = ogImageUrl ?? twitterImageUrl ?? schemaLogoUrl ?? appleTouchIconUrl ?? faviconUrl;
  const selectedLogoUrl = schemaLogoUrl ?? appleTouchIconUrl ?? faviconUrl;

  return {
    sourceUrl: normalizedUrl,
    finalUrl,
    title,
    canonicalUrl,
    ogImageUrl,
    twitterImageUrl,
    schemaLogoUrl,
    appleTouchIconUrl,
    faviconUrl,
    selectedImageUrl,
    selectedLogoUrl,
  };
}
