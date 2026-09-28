import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import type { ProbeAvailability } from "../core/types";

const execute = promisify(execFile);

export type CodecProbe = {
  availability: ProbeAvailability;
  h264Encode: boolean | null;
  hevcEncode: boolean | null;
  evidence: string[];
  reason: string;
};

export type LinuxHardwareProbeDependencies = {
  readDirectory?: (path: string) => Promise<string[]>;
  readText?: (path: string) => Promise<string>;
  run?: (command: string, args: string[], timeoutMs: number) => Promise<string>;
  platform?: string;
};

function codecEvidence(lines: string[], codec: "h264" | "hevc") {
  const profilePattern = codec === "h264" ? /VAProfileH264(?:Baseline|Main|High|ConstrainedBaseline)/i : /VAProfileHEVC(?:Main|Main10|Main12)/i;
  const encodePattern = /VAEntrypointEnc(?:Slice|SliceLP|Picture)/i;
  const matched: string[] = [];
  let supported = false;
  for (const line of lines) {
    if (profilePattern.test(line) || encodePattern.test(line)) matched.push(line.trim().slice(0, 180));
    if (profilePattern.test(line) && encodePattern.test(line)) supported = true;
  }
  return { supported, evidence: [...new Set(matched)].slice(0, 16) };
}

export function parseVaInfo(text: string): CodecProbe {
  if (text.length > 256 * 1024) return { availability: "ERROR", h264Encode: null, hevcEncode: null, evidence: [], reason: "vainfo_output_too_large" };
  const lines = text.split(/\r?\n/).slice(0, 4096);
  const h264 = codecEvidence(lines, "h264");
  const hevc = codecEvidence(lines, "hevc");
  const hasCodecEvidence = h264.evidence.length > 0 || hevc.evidence.length > 0;
  return {
    availability: hasCodecEvidence ? "SUPPORTED" : "NOT_TESTED",
    h264Encode: h264.evidence.length ? h264.supported : null,
    hevcEncode: hevc.evidence.length ? hevc.supported : null,
    evidence: [...new Set([...h264.evidence, ...hevc.evidence])].slice(0, 24),
    reason: hasCodecEvidence ? "parsed_vainfo_profile_and_entrypoint" : "codec_encode_capability_not_proven",
  };
}

const defaultRun = async (command: string, args: string[], timeoutMs: number) => {
  const result = await execute(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 256 * 1024 });
  return `${result.stdout}\n${result.stderr}`;
};

export async function probeLinuxHardware(dependencies: LinuxHardwareProbeDependencies = {}) {
  const currentPlatform = dependencies.platform ?? process.platform;
  if (currentPlatform !== "linux") {
    return {
      video: { availability: "UNSUPPORTED" as const, devices: [] as string[], captureProven: false },
      audio: { availability: "UNSUPPORTED" as const, devices: [] as string[], balancedLineInputProven: false },
      acceleration: { availability: "UNSUPPORTED" as const, renderNodes: [] as string[], intelGpuPresent: false, vaapi: "UNSUPPORTED" as const, qsv: "UNSUPPORTED" as const, h264Encode: null, hevcEncode: null, evidence: [] as string[], reason: "linux_only_probe" },
    };
  }

  const list = dependencies.readDirectory ?? readdir;
  const read = dependencies.readText ?? ((path: string) => readFile(path, "utf8"));
  const run = dependencies.run ?? defaultRun;
  const videoEntries = (await list("/dev").catch(() => [])).filter((name) => /^video\d+$/.test(name)).sort().slice(0, 64);
  const audioText = await read("/proc/asound/cards").catch(() => "");
  const audioEntries = audioText.split(/\r?\n/).filter((line) => /^\s*\d+\s+\[/.test(line)).map((line) => line.trim().slice(0, 120)).slice(0, 32);
  const renderEntries = (await list("/dev/dri").catch(() => [])).filter((name) => /^renderD\d+$/.test(name)).sort().slice(0, 16);
  const video = { availability: videoEntries.length ? "SUPPORTED" as const : "NOT_AVAILABLE" as const, devices: videoEntries.map((name) => `/dev/${name}`), captureProven: false };
  const audio = { availability: audioEntries.length ? "SUPPORTED" as const : "NOT_AVAILABLE" as const, devices: audioEntries, balancedLineInputProven: false };
  if (!renderEntries.length) {
    return { video, audio, acceleration: { availability: "NOT_AVAILABLE" as const, renderNodes: [], intelGpuPresent: false, vaapi: "NOT_AVAILABLE" as const, qsv: "NOT_AVAILABLE" as const, h264Encode: null, hevcEncode: null, evidence: [] as string[], reason: "no_drm_render_devices" } };
  }

  let intelGpuPresent = false;
  for (const entry of (await list("/sys/class/drm").catch(() => [])).filter((name) => /^card\d+$/.test(name)).slice(0, 16)) {
    const vendor = (await read(`/sys/class/drm/${entry}/device/vendor`).catch(() => "")).trim().toLowerCase();
    if (vendor === "0x8086") intelGpuPresent = true;
  }
  let combined = "";
  let utilityFound = false;
  let utilityFailure = false;
  for (const renderNode of renderEntries) {
    try {
      combined += `\n${await run("vainfo", ["--display", "drm", "--device", `/dev/dri/${renderNode}`], 4_000)}`;
      utilityFound = true;
      if (combined.length > 256 * 1024) { combined = combined.slice(0, 256 * 1024); break; }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      utilityFound = true;
      utilityFailure = true;
    }
  }
  if (!combined) {
    return { video, audio, acceleration: { availability: utilityFailure ? "ERROR" as const : "NOT_AVAILABLE" as const, renderNodes: renderEntries.map((name) => `/dev/dri/${name}`), intelGpuPresent, vaapi: utilityFailure ? "ERROR" as const : "NOT_AVAILABLE" as const, qsv: intelGpuPresent ? utilityFailure ? "ERROR" as const : "NOT_TESTED" as const : "NOT_AVAILABLE" as const, h264Encode: null, hevcEncode: null, evidence: [] as string[], reason: utilityFound ? "vainfo_failed_or_timed_out" : "vainfo_not_installed" } };
  }

  const parsed = parseVaInfo(combined);
  return {
    video,
    audio,
    acceleration: {
      availability: parsed.availability,
      renderNodes: renderEntries.map((name) => `/dev/dri/${name}`),
      intelGpuPresent,
      vaapi: parsed.availability,
      qsv: intelGpuPresent ? "NOT_TESTED" as const : "NOT_AVAILABLE" as const,
      h264Encode: parsed.h264Encode,
      hevcEncode: parsed.hevcEncode,
      evidence: parsed.evidence,
      reason: parsed.reason,
    },
  };
}