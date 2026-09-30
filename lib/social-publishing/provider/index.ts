import { MockSocialPublishingProvider } from "./mock";
import type { SocialPublishingProvider } from "../types";
import { SocialPublishingError } from "../errors";

export function resolveSocialPublishingProviderKey(): string {
  return process.env.SOCIAL_PUBLISH_PROVIDER ?? "unconfigured";
}

export function isSocialProviderAllowed(providerKey: string, environment = process.env.NODE_ENV): boolean {
  return !(environment === "production" && providerKey === "mock");
}

export function getSocialPublishingProvider(): SocialPublishingProvider {
  switch (resolveSocialPublishingProviderKey()) {
    case "mock":
      if (!isSocialProviderAllowed("mock")) {
        throw new SocialPublishingError("provider_not_configured", 503);
      }
      return new MockSocialPublishingProvider();
    default:
      throw new SocialPublishingError("provider_not_configured", 503);
  }
}
