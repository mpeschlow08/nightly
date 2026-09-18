import "server-only";

import { resolveLiveProviderKey } from "@/lib/live/config";

import { CloudflareLiveStreamProvider } from "./cloudflare-stream";
import { MockLiveStreamProvider } from "./mock";
import { MuxLiveStreamProvider } from "./mux";
import type { LiveStreamProvider } from "./types";

const cloudflareProvider = new CloudflareLiveStreamProvider();
const muxProvider = new MuxLiveStreamProvider();
const mockProvider = new MockLiveStreamProvider();

export function getLiveStreamProvider(): LiveStreamProvider {
  switch (resolveLiveProviderKey()) {
    case "cloudflare_stream":
      return cloudflareProvider;
    case "mux":
      return muxProvider;
    default:
      return mockProvider;
  }
}
