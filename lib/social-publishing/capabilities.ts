import type { SocialPlatform, SocialProviderCapabilities, SocialPublishingCapability } from "./types";

const mockCapabilities = new Set<SocialPublishingCapability>([
  "can_upload_video",
  "can_publish_video",
  "can_idempotently_publish",
  "can_delete_publication",
  "can_idempotently_delete_publication",
  "can_edit_publication",
  "can_schedule",
  "can_read_status",
  "can_read_analytics",
  "can_refresh_auth",
  "can_live_simulcast",
]);
const mockPlatforms: ReadonlySet<SocialPlatform> = new Set(["instagram", "facebook", "tiktok", "youtube", "x"]);

export function getProviderCapabilities(providerKey: string, platform: SocialPlatform): SocialProviderCapabilities {
  if (providerKey === "mock" && mockPlatforms.has(platform)) return mockCapabilities;
  return new Set<SocialPublishingCapability>();
}

export function supportsCapability(capabilities: SocialProviderCapabilities, capability: SocialPublishingCapability): boolean {
  return capabilities.has(capability);
}

export function assertCapability(capabilities: SocialProviderCapabilities, capability: SocialPublishingCapability): void {
  if (!supportsCapability(capabilities, capability)) {
    throw new Error("unsupported_capability");
  }
}
