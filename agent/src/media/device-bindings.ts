import type { DeviceMediaBinding } from "../../../lib/nightly-device/media-bindings";
import type { ControlPlaneConfig } from "../core/types";
import type { CanonicalMediaBindings } from "./runtime";
import type { AuthorizedMediaSource, MediaPolicy } from "./contracts";
import { mediaInput, type ResolvedStream } from "./engine";

export class DeviceMediaBindings implements CanonicalMediaBindings {
  private snapshot: { revision: string; expiresAt: number; sources: Map<number, DeviceMediaBinding>; policy: MediaPolicy } | null = null;
  private readonly locators = new Map<number, { locator: string; expiresAt: number }>();

  private deviceId = 0;
  private venueId = 0;

  constructor(private readonly request?: (sourceId: number, revision: string) => Promise<unknown>, private readonly now: () => number = Date.now) {}

  bindIdentity(deviceId: number, venueId: number): void {
    if (!Number.isSafeInteger(deviceId) || deviceId <= 0 || !Number.isSafeInteger(venueId) || venueId <= 0) throw new Error("media_device_identity_invalid");
    if (this.deviceId !== deviceId || this.venueId !== venueId) this.clear();
    this.deviceId = deviceId;
    this.venueId = venueId;
  }

  clear(): void { this.snapshot = null; this.locators.clear(); }

  get revision(): string | null { return this.snapshot?.revision ?? null; }
  get expiresAt(): number { return this.snapshot?.expiresAt ?? 0; }

  update(config: ControlPlaneConfig): void {
    const media = config.sections?.media;
    if (config.ok !== true || config.deviceId !== this.deviceId || config.venueId !== this.venueId ||
        config.configAvailable !== true || typeof config.configRevision !== "string" || !config.configRevision.length || config.configRevision.length > 128 ||
        !media || media.revision !== config.configRevision || media.ttlSeconds !== 300 || !Array.isArray(media.sources) || media.sources.length > 4 ||
        !config.sections.privacy || !config.sections.service || !config.sections.recovery ||
        typeof config.sections.privacy.mode !== "string" || typeof config.sections.privacy.contentEligibility !== "string" ||
        typeof config.sections.privacy.publicPublishingEnabled !== "boolean" || !Number.isSafeInteger(config.sections.privacy.revision) ||
        typeof config.sections.service.entitlementState !== "string" || typeof config.sections.service.hotReelEligible !== "boolean" ||
        typeof config.sections.service.liveEligible !== "boolean" || !Number.isSafeInteger(config.sections.service.revision) ||
        typeof config.sections.recovery.enabled !== "boolean") throw new Error("invalid_device_config");
    const sources = new Map<number, DeviceMediaBinding>();
    for (const binding of media.sources) {
      if (!binding || !Number.isSafeInteger(binding.sourceId) || binding.sourceId <= 0 || sources.has(binding.sourceId) ||
          binding.deviceId !== this.deviceId || binding.venueId !== this.venueId || binding.enabled !== true ||
          !(["ip_camera", "hdmi_input", "mixer_audio", "ambient_audio"] as unknown[]).includes(binding.sourceType) ||
          (binding.sourceType === "ip_camera"
            ? !Number.isSafeInteger(binding.venueCameraId) || binding.venueCameraId! <= 0 || binding.capability !== "rtsp"
            : binding.venueCameraId !== null || binding.capability !== "not_tested")) throw new Error("invalid_media_binding");
      sources.set(binding.sourceId, { sourceId: binding.sourceId, deviceId: this.deviceId, venueId: this.venueId,
        sourceType: binding.sourceType, venueCameraId: binding.venueCameraId, enabled: true, capability: binding.capability });
    }
    const time = this.now();
    if (!Number.isSafeInteger(time) || time < 0) throw new Error("invalid_media_clock");
    for (const sourceId of this.locators.keys()) {
      if (this.snapshot?.revision !== config.configRevision || !sources.has(sourceId) ||
          this.snapshot.sources.get(sourceId)?.venueCameraId !== sources.get(sourceId)?.venueCameraId ||
          this.locators.get(sourceId)!.expiresAt <= time) this.locators.delete(sourceId);
    }
    this.snapshot = { revision: config.configRevision, expiresAt: time + 300_000, sources, policy: {
      deviceId: this.deviceId, venueId: this.venueId,
      serviceActive: config.sections.service.entitlementState === "active",
      contentEligible: config.sections.privacy.contentEligibility === "approved",
      hotReelEligible: config.sections.service.hotReelEligible,
      publicPublishingEnabled: config.sections.privacy.publicPublishingEnabled,
      privacyRestricted: config.sections.privacy.mode === "restricted", masksApplied: false,
    } };
  }

  private current() {
    if (!this.snapshot || this.now() >= this.snapshot.expiresAt) throw new Error("media_config_expired");
    return this.snapshot;
  }

  async list(): Promise<number[]> {
    const current = this.current();
    return [...current.sources.values()].filter((source) => source.capability === "rtsp").map((source) => source.sourceId);
  }

  async resolve(sourceId: number): Promise<{ source: AuthorizedMediaSource; policy: MediaPolicy }> {
    const current = this.current();
    const binding = current.sources.get(sourceId);
    if (!binding || binding.sourceType !== "ip_camera" || binding.capability !== "rtsp") throw new Error("media_source_unavailable");
    return { source: {
      deviceId: this.deviceId, venueId: this.venueId, sourceId, venueCameraId: binding.venueCameraId,
      kind: "IP_CAMERA", audioRole: "CAMERA_AUDIO", active: true,
      locator: this.locators.get(sourceId)?.locator ?? `rtsp://nightly-source-${sourceId}.invalid/live`, privacyMasksRequired: false,
    }, policy: { ...current.policy } };
  }

  async credential(sourceId: number): Promise<ResolvedStream> {
    const current = this.current();
    if (current.sources.get(sourceId)?.capability !== "rtsp") throw new Error("media_source_unavailable");
    if (!this.request) throw new Error("media_credential_unavailable");
    const result = await this.request(sourceId, current.revision) as Record<string, unknown> | null;
    if (this.current() !== current || !result || result.ok !== true || result.sourceId !== sourceId || result.configRevision !== current.revision ||
        result.ttlSeconds !== 60 || typeof result.streamUrl !== "string" || typeof result.expiresAt !== "string") throw new Error("media_credential_invalid");
    const expiry = Date.parse(result.expiresAt);
    const time = this.now();
    if (!Number.isFinite(expiry) || expiry <= time || expiry > time + 60_000 || expiry > current.expiresAt ||
        result.streamUrl !== result.streamUrl.trim() || result.streamUrl.length > 2048 || /[\x00-\x1f]/.test(result.streamUrl)) throw new Error("media_credential_invalid");
    let locator: string;
    try {
      const url = new URL(result.streamUrl);
      if (url.protocol !== "rtsp:" || !url.hostname || !url.username || !url.password || url.search || url.hash) throw new Error();
      url.username = "";
      url.password = "";
      locator = url.href;
      mediaInput({ ...(await this.resolve(sourceId)).source, locator });
    } catch { throw new Error("media_credential_invalid"); }
    this.locators.set(sourceId, { locator, expiresAt: expiry });
    return { sourceId, configRevision: current.revision, streamUrl: result.streamUrl, expiresAt: result.expiresAt };
  }
}