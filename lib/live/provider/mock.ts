import "server-only";

import type {
  CreateLiveInputRequest,
  LiveInputDescriptor,
  LiveStreamHealth,
  LiveStreamProvider,
  PlaybackAuthorization,
} from "./types";

export class MockLiveStreamProvider implements LiveStreamProvider {
  readonly providerKey = "mock";

  isConfigured() {
    return true;
  }

  async createLiveInput(input: CreateLiveInputRequest): Promise<LiveInputDescriptor> {
    return {
      liveInputId: `mock-live-input-${input.cameraId}`,
      playbackId: `mock-live-input-${input.cameraId}`,
      playbackHlsUrl: null,
      ingestRtmpsUrl: null,
      ingestSrtUrl: null,
      ingestCredentialsIssued: false,
      providerStatus: "reconnecting",
    };
  }

  async getLiveInput(liveInputId: string): Promise<LiveInputDescriptor> {
    return {
      liveInputId,
      playbackId: liveInputId,
      playbackHlsUrl: null,
      ingestRtmpsUrl: null,
      ingestSrtUrl: null,
      ingestCredentialsIssued: false,
      providerStatus: "reconnecting",
    };
  }

  async disableLiveInput(): Promise<void> {
    return;
  }

  async getStreamHealth(): Promise<LiveStreamHealth> {
    return {
      providerStatus: "reconnecting",
      isLive: false,
      activeVideoId: null,
      playbackHost: null,
    };
  }

  async createPlaybackAuthorization(_videoId: string, expiresAtUnix: number): Promise<PlaybackAuthorization> {
    return {
      token: "",
      expiresAtUnix,
    };
  }
}
