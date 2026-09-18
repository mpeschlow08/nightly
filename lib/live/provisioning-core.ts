import { mapNightlyStreamState } from "./stream-state";
import type { LiveInputDescriptor, LiveStreamProvider } from "./provider/types";

export type ProvisioningCameraRecord = {
  id: number;
  venueId: number;
  name: string;
  status: string;
  liveProvider: string | null;
  providerLiveInputId: string | null;
};

export type ProvisioningStore = {
  setProvisioningPending: (cameraId: number) => Promise<void>;
  markReady: (input: {
    cameraId: number;
    provider: string;
    descriptor: LiveInputDescriptor;
    now: Date;
  }) => Promise<void>;
  markReadyExisting: (input: {
    cameraId: number;
    descriptor: LiveInputDescriptor;
    now: Date;
  }) => Promise<void>;
  markError: (input: { cameraId: number; message: string }) => Promise<void>;
};

export async function provisionLiveInputForCameraCore(input: {
  camera: ProvisioningCameraRecord;
  provider: LiveStreamProvider;
  store: ProvisioningStore;
  now: Date;
}): Promise<{
  cameraId: number;
  provider: string;
  liveInputId: string;
  provisioningStatus: "ready";
  streamState: "provisioning" | "ready" | "live" | "offline" | "error" | "disabled";
  ingestRtmpsUrl: string | null;
  ingestSrtUrl: string | null;
  ingestCredentialsIssued: boolean;
  idempotent: boolean;
}> {
  const camera = input.camera;
  const provider = input.provider;

  if (!provider.isConfigured()) {
    throw new Error("Live provider is not configured.");
  }

  if (camera.providerLiveInputId && camera.liveProvider === provider.providerKey) {
    const existing = await provider.getLiveInput(camera.providerLiveInputId);
    await input.store.markReadyExisting({ cameraId: camera.id, descriptor: existing, now: input.now });
    return {
      cameraId: camera.id,
      provider: provider.providerKey,
      liveInputId: existing.liveInputId,
      provisioningStatus: "ready",
      streamState: mapNightlyStreamState({
        cameraEnabled: camera.status === "enabled",
        provisioningStatus: "ready",
        providerStatus: existing.providerStatus,
      }),
      ingestRtmpsUrl: existing.ingestRtmpsUrl,
      ingestSrtUrl: existing.ingestSrtUrl,
      ingestCredentialsIssued: existing.ingestCredentialsIssued,
      idempotent: true,
    };
  }

  await input.store.setProvisioningPending(camera.id);

  try {
    const created = await provider.createLiveInput({
      idempotencyKey: `nightly-live-camera-${camera.id}`,
      label: `${camera.name} (${camera.venueId}:${camera.id})`,
      venueId: camera.venueId,
      cameraId: camera.id,
    });

    await input.store.markReady({
      cameraId: camera.id,
      provider: provider.providerKey,
      descriptor: created,
      now: input.now,
    });

    return {
      cameraId: camera.id,
      provider: provider.providerKey,
      liveInputId: created.liveInputId,
      provisioningStatus: "ready",
      streamState: mapNightlyStreamState({
        cameraEnabled: camera.status === "enabled",
        provisioningStatus: "ready",
        providerStatus: created.providerStatus,
      }),
      ingestRtmpsUrl: created.ingestRtmpsUrl,
      ingestSrtUrl: created.ingestSrtUrl,
      ingestCredentialsIssued: created.ingestCredentialsIssued,
      idempotent: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning failed.";
    await input.store.markError({ cameraId: camera.id, message });
    throw error;
  }
}
