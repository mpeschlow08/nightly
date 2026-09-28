import { lookup } from "node:dns/promises";
import { statfs } from "node:fs/promises";
import { platform, arch } from "node:os";
import type { DeviceCapabilityRecord } from "../../../lib/nightly-device/foundation";
import type { AgentConfig, AgentInventoryRequest, ProbeAvailability, ProbeResult } from "../core/types";
import type { DiscoverySnapshot, PlatformProbeAdapter } from "./platform";
import { commissioningStatus } from "./platform";
import { OnvifDiscoveryClient, type OnvifDiscoveryResult } from "./onvif-discovery";
import { probeLinuxHardware, type LinuxHardwareProbeDependencies } from "./linux-hardware";

function result(key: ProbeResult["key"], status: ProbeResult["status"], summary: string, evidence: Record<string, unknown>, remediationHint?: string): ProbeResult {
  return { key, status, summary, checkedAt: new Date().toISOString(), evidence, ...(remediationHint ? { remediationHint } : {}) };
}

async function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("probe_timeout")), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}

export class LinuxProbeAdapter implements PlatformProbeAdapter {
  constructor(
    private readonly resolver: typeof lookup = lookup,
    private readonly hardwareDependencies: LinuxHardwareProbeDependencies = {},
    private readonly onvifClient: OnvifDiscoveryClient = new OnvifDiscoveryClient(),
  ) {}

  async discover(config: AgentConfig): Promise<DiscoverySnapshot> {
    const probes: ProbeResult[] = [];
    const availability: Record<string, ProbeAvailability> = {};
    const sources: AgentInventoryRequest["sources"] = [];
    const capabilities: DeviceCapabilityRecord[] = [];

    const hardware = await probeLinuxHardware({ ...this.hardwareDependencies, platform: this.hardwareDependencies.platform ?? platform() });
    const videoNodes = hardware.video.devices;
    let onvif: OnvifDiscoveryResult = { devices: [], malformedResponses: 0, oversizedResponses: 0 };
    let onvifError: string | null = null;
    if ((this.hardwareDependencies.platform ?? platform()) === "linux") {
      try { onvif = await this.onvifClient.discover({ durationMs: config.sourceDiscoveryWindowMs }); }
      catch (error) { onvifError = error instanceof Error ? error.name : "discovery_error"; }
    }
    availability.cameras = onvif.devices.length > 0 || videoNodes.length > 0
      ? "SUPPORTED"
      : onvifError ? "ERROR" : hardware.video.availability;
    probes.push(result("cameras", "not_tested", `${videoNodes.length} local V4L2 node(s); ${onvif.devices.length} ONVIF device(s) discovered. Capture and authenticated stream validation remain untested.`, {
      availability: availability.cameras,
      v4l2DeviceCount: videoNodes.length,
      onvifDeviceCount: onvif.devices.length,
      onvifMalformedResponses: onvif.malformedResponses,
      onvifOversizedResponses: onvif.oversizedResponses,
      ...(onvifError ? { onvifDiscoveryError: onvifError } : {}),
      captureValidated: false,
      streamValidated: false,
    }, videoNodes.length || onvif.devices.length ? undefined : "Connect a supported capture device or ONVIF camera and verify outbound multicast network access."));
    for (const path of videoNodes) sources.push({ sourceType: "other", sourceLabel: `agent:v4l2:${path}`, enabled: true, evidence: { interface: "v4l2", availability: "DETECTED", captureValidated: false } });
    capabilities.push({ category: "other", name: "v4l2_video_device_count", value: videoNodes.length, supported: videoNodes.length > 0, metadata: { availability: hardware.video.availability, captureValidated: false } });
    capabilities.push({ category: "onvif", name: "discovered_device_count", value: onvif.devices.length, supported: onvif.devices.length > 0, metadata: { availability: onvifError ? "ERROR" : (this.hardwareDependencies.platform ?? platform()) === "linux" ? "SUPPORTED" : "UNSUPPORTED", malformedResponses: onvif.malformedResponses, oversizedResponses: onvif.oversizedResponses } });

    availability.audio = hardware.audio.availability;
    const audioStatus = hardware.audio.availability === "NOT_AVAILABLE" ? "warning" : "not_tested";
    probes.push(result("audio", audioStatus, hardware.audio.devices.length ? `${hardware.audio.devices.length} ALSA interface(s) detected; input channel count and balanced line-level capability are untested.` : hardware.audio.availability === "UNSUPPORTED" ? "ALSA capture discovery is unsupported on this platform." : "No ALSA audio interface detected.", {
      availability: availability.audio,
      deviceCount: hardware.audio.devices.length,
      devices: hardware.audio.devices,
      balancedLineInputValidated: false,
    }, hardware.audio.availability === "NOT_AVAILABLE" ? "Connect an audio interface and verify ALSA device permissions." : undefined));
    capabilities.push({ category: "audio_mixer", name: "alsa_interface_count", value: hardware.audio.devices.length, supported: hardware.audio.devices.length > 0, metadata: { availability: hardware.audio.availability, balancedLineInputValidated: false } });

    availability.hdmi = hardware.video.devices.length ? "NOT_TESTED" : hardware.video.availability === "UNSUPPORTED" ? "UNSUPPORTED" : "NOT_AVAILABLE";
    probes.push(result("hdmi", "not_tested", "V4L2 nodes are detected but not attributed to HDMI and do not prove signal lock or resolution.", { availability: availability.hdmi, v4l2NodeCount: hardware.video.devices.length, signalLock: "NOT_TESTED", resolution: "NOT_TESTED" }));
    capabilities.push({ category: "hdmi_input", name: "signal_lock", value: null, supported: false, metadata: { availability: "NOT_TESTED" } });

    availability.hardwareAcceleration = hardware.acceleration.availability;
    probes.push(result("hardware_acceleration", "not_tested", hardware.acceleration.reason === "parsed_vainfo_profile_and_entrypoint" ? "VA-API profiles and encode entrypoints were detected; sustained hardware encoding is not tested." : "Hardware encoder support was not proven by available Linux tools.", {
      availability: availability.hardwareAcceleration,
      renderNodes: hardware.acceleration.renderNodes,
      intelGpuPresent: hardware.acceleration.intelGpuPresent,
      vaapi: hardware.acceleration.vaapi,
      quickSync: hardware.acceleration.qsv,
      h264Encode: hardware.acceleration.h264Encode,
      hevcEncode: hardware.acceleration.hevcEncode,
      evidence: hardware.acceleration.evidence,
      reason: hardware.acceleration.reason,
      encodeSmokeTest: "NOT_TESTED",
    }, "Validate an actual encode/decode workload on the target hardware before enabling acceleration."));
    capabilities.push({ category: "vaapi", name: "h264_encode", value: hardware.acceleration.h264Encode, supported: hardware.acceleration.h264Encode === true, metadata: { availability: hardware.acceleration.vaapi } });
    capabilities.push({ category: "vaapi", name: "hevc_encode", value: hardware.acceleration.hevcEncode, supported: hardware.acceleration.hevcEncode === true, metadata: { availability: hardware.acceleration.vaapi } });
    capabilities.push({ category: "intel_qsv", name: "h264_encode", value: null, supported: false, metadata: { availability: hardware.acceleration.qsv, intelGpuPresent: hardware.acceleration.intelGpuPresent } });
    capabilities.push({ category: "intel_qsv", name: "hevc_encode", value: null, supported: false, metadata: { availability: hardware.acceleration.qsv, intelGpuPresent: hardware.acceleration.intelGpuPresent } });

    let storageEvidence: Record<string, unknown> = { availability: "NOT_AVAILABLE" };
    let storageStatus: ProbeResult["status"] = "warning";
    try {
      const fs = await statfs(config.stateDirectory);
      const availableBytes = Number(fs.bavail) * Number(fs.bsize);
      const totalBytes = Number(fs.blocks) * Number(fs.bsize);
      storageEvidence = { availability: "SUPPORTED", availableBytes, totalBytes };
      storageStatus = availableBytes > 256 * 1024 * 1024 ? "pass" : "warning";
      availability.storage = "SUPPORTED";
    } catch {
      availability.storage = "NOT_AVAILABLE";
    }
    probes.push(result("storage", storageStatus, storageStatus === "pass" ? "Agent state storage is accessible with adequate free space." : "Agent state storage is unavailable or has limited free space.", storageEvidence));
    capabilities.push({ category: "storage", name: "state_directory", value: config.stateDirectory, supported: availability.storage === "SUPPORTED", metadata: storageEvidence });

    let networkStatus: ProbeResult["status"] = "warning";
    const targetHost = new URL(config.controlPlaneUrl).hostname;
    try {
      const addresses = await bounded(this.resolver(targetHost, { all: true }), 2_000);
      networkStatus = addresses.length ? "pass" : "warning";
      availability.internet = addresses.length ? "SUPPORTED" : "NOT_AVAILABLE";
      probes.push(result("internet", networkStatus, addresses.length ? "Control Plane host resolved through DNS." : "Control Plane host did not resolve.", { availability: availability.internet, addressCount: addresses.length }));
    } catch {
      availability.internet = "NOT_AVAILABLE";
      probes.push(result("internet", networkStatus, "Control Plane host DNS lookup failed or timed out.", { availability: availability.internet }, "Check DNS and outbound network access."));
    }

    availability.nightlyCloud = "NOT_TESTED";
    probes.push(result("nightly_cloud", "not_tested", "Cloud reachability is reported by authenticated Control Plane requests.", { availability: availability.nightlyCloud }));
    capabilities.push({ category: "tpm", name: "sealed_credentials", value: null, supported: false, metadata: { availability: platform() === "linux" ? "NOT_TESTED" : "UNSUPPORTED", implementation: "not_implemented" } });
    capabilities.push({ category: "watchdog", name: "systemd", value: process.env.WATCHDOG_USEC ? true : null, supported: Boolean(process.env.WATCHDOG_USEC), metadata: { availability: process.env.WATCHDOG_USEC ? "DETECTED" : "NOT_TESTED" } });

    const commissioning = probes.map((probe) => ({
      checkKey: probe.key,
      status: config.simulation ? "not_tested" as const : commissioningStatus(probe.status),
      summary: config.simulation ? `SIMULATED: ${probe.summary}` : probe.summary,
      checkedAt: probe.checkedAt,
      evidence: { ...probe.evidence, ...(config.simulation ? { simulated: true, marker: "SIMULATED" } : {}) },
      remediationHint: probe.remediationHint ?? null,
    }));

    if (config.simulation) {
      probes.splice(0, probes.length, ...probes.map((probe) => ({ ...probe, status: "not_tested" as const, summary: `SIMULATED: ${probe.summary}`, evidence: { ...probe.evidence, simulated: true, marker: "SIMULATED" } })));
    }

    return {
      platform: platform(),
      architecture: arch(),
      probes,
      availability,
      inventory: { sources },
      capabilities: { capabilities },
      commissioning: { checks: commissioning },
      onvifDevices: onvif.devices,
    };
  }
}

export class SimulationProbeAdapter implements PlatformProbeAdapter {
  async discover(config: AgentConfig): Promise<DiscoverySnapshot> {
    if (!config.simulation) throw new Error("Simulation probe adapter requires explicit simulation mode.");
    const keys: ProbeResult["key"][] = ["cameras", "audio", "hdmi", "hardware_acceleration", "storage", "internet", "nightly_cloud"];
    const probes = keys.map((key) => result(key, "not_tested", `SIMULATED: ${key} hardware results are not tested.`, { simulated: true, marker: "SIMULATED", availability: "NOT_TESTED" }));
    return {
      platform: "simulated",
      architecture: "simulated",
      probes,
      availability: Object.fromEntries(keys.map((key) => [key, "NOT_TESTED"])),
      inventory: { sources: [] },
      capabilities: { capabilities: [
        { category: "other", name: "simulation_mode", value: true, supported: false, metadata: { simulated: true, marker: "SIMULATED" } },
        { category: "tpm", name: "sealed_credentials", value: null, supported: false, metadata: { simulated: true, availability: "NOT_TESTED" } },
      ] },
      commissioning: { checks: probes.map((probe) => ({ checkKey: probe.key, status: "not_tested", summary: probe.summary, checkedAt: probe.checkedAt, evidence: probe.evidence })) },
      onvifDevices: [],
    };
  }
}