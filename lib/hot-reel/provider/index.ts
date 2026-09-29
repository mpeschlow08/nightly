import { MockHotReelProvider } from "./mock";
import { VercelBlobHotReelProvider } from "./vercel-blob";
import type { HotReelStorageProvider } from "./types";

export function resolveHotReelProviderKey(): string {
  return process.env.HOT_REEL_PROVIDER ?? "mock";
}

export function getHotReelProvider(): HotReelStorageProvider {
  switch (resolveHotReelProviderKey()) {
    case "vercel_blob":
      return new VercelBlobHotReelProvider();
    default:
      return new MockHotReelProvider();
  }
}
