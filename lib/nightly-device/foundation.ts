export const DeviceLifecycleState = {
  FACTORY: "factory",
  INVENTORY: "inventory",
  PROVISIONED: "provisioned",
  UNCLAIMED: "unclaimed",
  CLAIMED: "claimed",
  ACTIVE: "active",
  DEGRADED: "degraded",
  OFFLINE: "offline",
  SUSPENDED: "suspended",
  RETURN_PENDING: "return_pending",
  RMA: "rma",
  REVOKED: "revoked",
  REPROVISIONING: "reprovisioning",
  RETIRED: "retired",
} as const;

export const DeviceProvisioningState = {
  INVENTORY: "inventory",
  PROVISIONING: "provisioning",
  PROVISIONED: "provisioned",
  REPROVISIONING: "reprovisioning",
  FAILED: "failed",
  REVOKED: "revoked",
} as const;

export const DeviceClaimState = {
  UNCLAIMED: "unclaimed",
  CLAIMED: "claimed",
  PENDING: "pending",
  REJECTED: "rejected",
  REVOKED: "revoked",
  EXPIRED: "expired",
} as const;

export const DeviceOperationalState = {
  STARTING: "starting",
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  OFFLINE: "offline",
  SUSPENDED: "suspended",
  MAINTENANCE: "maintenance",
} as const;

export const DeviceCapabilityCategory = {
  RTSP: "rtsp",
  ONVIF: "onvif",
  HDMI_INPUT: "hdmi_input",
  AUDIO_MIXER: "audio_mixer",
  AMBIENT_AUDIO: "ambient_audio",
  INTEL_QSV: "intel_qsv",
  VAAPI: "vaapi",
  H264: "h264",
  H265: "h265",
  SRT_OUTPUT: "srt_output",
  RTMP_OUTPUT: "rtmp_output",
  HLS_OUTPUT: "hls_output",
  ROLLING_BUFFER: "rolling_buffer",
  WATCHDOG: "watchdog",
  TPM: "tpm",
  SECURE_BOOT: "secure_boot",
  WIFI: "wifi",
  ETHERNET: "ethernet",
  STORAGE: "storage",
  OTHER: "other",
} as const;

export type DeviceCapabilityCategoryValue = (typeof DeviceCapabilityCategory)[keyof typeof DeviceCapabilityCategory];

export type DeviceCapabilityRecord = {
  category: DeviceCapabilityCategoryValue;
  name: string;
  value: string | number | boolean | null;
  supported: boolean;
  metadata?: Record<string, unknown>;
};

export const SECRET_SENSITIVE_KEYS = new Set([
  "secret",
  "token",
  "password",
  "passphrase",
  "key",
  "credential",
  "ssid",
  "api_key",
  "access_token",
  "refresh_token",
]);

const NORMALIZED_SECRET_SENSITIVE_KEYS = new Set(
  [...SECRET_SENSITIVE_KEYS].map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""))
);

const SENSITIVE_TEXT_PATTERN = /secret|token|password|passphrase|credential|api[_-]?key|private[_-]?key|ssid|wifi/i;

export function assertNotSecretPayload(value: unknown) {
  if (typeof value === "string") {
    if (SENSITIVE_TEXT_PATTERN.test(value)) {
      throw new Error("Sensitive device metadata (secret, credential, token, or key material) is not allowed in capability payloads.");
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => assertNotSecretPayload(entry));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (NORMALIZED_SECRET_SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
        throw new Error(`Sensitive capability field "${key}" is not allowed.`);
      }

      if (typeof nestedValue === "string" && SENSITIVE_TEXT_PATTERN.test(nestedValue)) {
        throw new Error(`Sensitive capability value for field "${key}" is not allowed.`);
      }

      assertNotSecretPayload(nestedValue);
    }
  }
}

export function validateDeviceCapabilityBundle(capabilities: DeviceCapabilityRecord[]) {
  if (!Array.isArray(capabilities)) {
    throw new Error("Device capability bundle must be an array.");
  }
  if (capabilities.length > 256) {
    throw new Error("Device capability bundle exceeds the supported item limit.");
  }

  const seenCapabilities = new Set<string>();
  for (const capability of capabilities) {
    if (!capability || typeof capability !== "object") {
      throw new Error("Each device capability must be an object.");
    }

    if (!capability.category || !Object.values(DeviceCapabilityCategory).includes(capability.category)) {
      throw new Error(`Unsupported capability category: ${String(capability.category)}`);
    }

    if (typeof capability.name !== "string" || capability.name.trim().length === 0 || capability.name.trim() !== capability.name || capability.name.length > 120) {
      throw new Error("Capability name is required.");
    }

    const capabilityKey = `${capability.category}:${capability.name.toLowerCase()}`;
    if (seenCapabilities.has(capabilityKey)) throw new Error("Duplicate device capability.");
    seenCapabilities.add(capabilityKey);

    if (typeof capability.supported !== "boolean") {
      throw new Error("Capability support state must be a boolean.");
    }

    if (capability.value !== null && typeof capability.value !== "string" && typeof capability.value !== "boolean" && !(typeof capability.value === "number" && Number.isFinite(capability.value))) {
      throw new Error("Capability value must be a finite scalar or null.");
    }

    if (typeof capability.metadata !== "undefined" && (!capability.metadata || typeof capability.metadata !== "object" || Array.isArray(capability.metadata))) {
      throw new Error("Capability metadata must be an object.");
    }

    if (capability.metadata) {
      assertNotSecretPayload(capability.metadata);
    }

    if (typeof capability.value === "string") {
      assertNotSecretPayload(capability.value);
    }
  }

  return true;
}

export type DeviceClaimCode = {
  code: string;
  expiresAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
};

export function validateClaimCode(claim: DeviceClaimCode) {
  if (!claim || typeof claim.code !== "string" || claim.code.trim().length === 0) {
    throw new Error("Claim code is required.");
  }

  if (claim.revokedAt) {
    throw new Error("Claim code has been revoked.");
  }

  if (claim.usedAt) {
    throw new Error("Claim code has already been used and cannot be replayed.");
  }

  if (claim.expiresAt && claim.expiresAt.getTime() <= Date.now()) {
    throw new Error("Claim code has expired.");
  }

  return true;
}

export function buildDeviceAccessError(code: string, message: string) {
  return {
    error: {
      code,
      message,
    },
  };
}

export function createDeviceStatusSummary(status: string, health: string) {
  return {
    status,
    health,
    timestamp: new Date().toISOString(),
  };
}
