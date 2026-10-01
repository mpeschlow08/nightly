import type {
  AgentBootstrapRequest,
  AgentBootstrapResponse,
  AgentCommissioningRequest,
  ControlPlaneConfig,
  AgentHeartbeatRequest,
  AgentInventoryRequest,
  AgentCapabilityRequest,
  ControlPlaneStatus,
} from "./types";
import { withRetry } from "./retry";

export class ControlPlaneError extends Error {
  constructor(message: string, readonly status: number | null, readonly code: string | null, readonly retryable: boolean) {
    super(message);
    this.name = "ControlPlaneError";
  }
}

type ClientOptions = {
  baseUrl: string;
  deviceUuid: string;
  requestTimeoutMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
  fetchImpl?: typeof fetch;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class ControlPlaneClient {
  readonly #fetch: typeof fetch;

  constructor(private readonly options: ClientOptions) {
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async bootstrap(input: AgentBootstrapRequest, persistSecret: (secret: string) => Promise<void>) {
    let response: Response;
    try {
      response = await this.#request("/api/device/v1/bootstrap", { method: "POST", body: JSON.stringify(input) });
    } catch {
      throw new ControlPlaneError("Bootstrap outcome is unknown; recovery is required before retrying the one-time token.", null, "bootstrap_outcome_unknown", false);
    }
    const result = await this.#readJson<AgentBootstrapResponse>(response);
    if (!result.deviceSecret || !result.device || !Number.isInteger(result.device.id)) throw new ControlPlaneError("Bootstrap response was incomplete.", response.status, "invalid_bootstrap_response", false);
    try { await persistSecret(result.deviceSecret); } catch {
      throw new ControlPlaneError("Device secret could not be durably stored after bootstrap; recovery is required.", null, "credential_persistence_failed", false);
    }
    return result.device;
  }

  async heartbeat(credentials: string, version: AgentHeartbeatRequest) {
    return this.#authorizedRequest<{ ok: true; device: { id: number; uuid: string; venueId: number | null; status: string; serviceEntitlementState: string; operationalState: string; timestamp: string } }>(credentials, "/api/device/v1/heartbeat", "POST", version);
  }

  async listOperations(credentials: string) {
    return this.#authorizedRequest<{ ok: true; operations: Array<{ id: number; type: string; expiresAt: string }> }>(credentials, "/api/device/v1/operations", "GET");
  }

  async completeHealthCheck(credentials: string, id: number, resultCode: "health_ok" | "health_degraded") {
    return this.#authorizedRequest<{ ok: true; id: number; resultCode: string; duplicate: boolean }>(credentials, "/api/device/v1/operations", "POST", { id, resultCode });
  }

  async getStatus(credentials: string) {
    return this.#authorizedRequest<ControlPlaneStatus>(credentials, "/api/device/v1/status", "POST");
  }

  async getConfig(credentials: string) {
    return this.#authorizedRequest<ControlPlaneConfig>(credentials, "/api/device/v1/config", "GET");
  }

  async resolveMediaCredential(credentials: string, sourceId: number, expectedRevision: string) {
    try {
      return await this.#authorizedRequest<unknown>(credentials, "/api/device/v1/media-credentials", "POST", { sourceId, expectedRevision });
    } catch (error) {
      if (error instanceof ControlPlaneError) throw new ControlPlaneError("Media credential request failed.", error.status, error.code === "config_revision_conflict" ? error.code : "media_credential_unavailable", error.retryable);
      throw new ControlPlaneError("Media credential request failed.", null, "media_credential_unavailable", false);
    }
  }

  async reportSessionMedia(credentials: string, reference: { publicId: string; sourceId: number; candidateId: string;
    hotId: string; mediaRevision: number; configRevision: string; windowStartAt: string; windowEndAt: string }) {
    return this.#authorizedRequest<{ ok: boolean; attributed: boolean }>(credentials, "/api/device/v1/session-media", "POST", reference);
  }

  async acknowledgeConfig(credentials: string, revision: string) {
    return this.#authorizedRequest<{ ok: true; acknowledged: boolean; configRevision: string }>(credentials, "/api/device/v1/config", "POST", { configRevision: revision, appliedConfigRevision: revision });
  }

  async replaceCapabilities(credentials: string, report: AgentCapabilityRequest) {
    return this.#authorizedRequest<{ ok: true; capabilityCount: number }>(credentials, "/api/device/v1/capabilities", "POST", report);
  }

  async replaceInventory(credentials: string, report: AgentInventoryRequest) {
    return this.#authorizedRequest<{ ok: true; sourceCount: number }>(credentials, "/api/device/v1/inventory", "POST", report);
  }

  async reportCommissioning(credentials: string, report: AgentCommissioningRequest) {
    return this.#authorizedRequest<{ ok: true; checkCount: number }>(credentials, "/api/device/v1/commissioning", "POST", report);
  }

  async #authorizedRequest<T>(secret: string, path: string, method: string, body?: unknown): Promise<T> {
    return withRetry(async () => {
      const response = await this.#request(path, {
        method,
        headers: { "x-nightly-device-uuid": this.options.deviceUuid, Authorization: `Bearer ${secret}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return this.#readJson<T>(response);
    }, {
      baseDelayMs: this.options.retryBaseMs,
      maxDelayMs: this.options.retryMaxMs,
      maxAttempts: 5,
      random: this.options.random,
      sleep: this.options.sleep,
      shouldRetry: (error) => error instanceof ControlPlaneError && error.retryable,
    });
  }

  async #request(path: string, init: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);
    try {
      return await this.#fetch(`${this.options.baseUrl}${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
        signal: controller.signal,
      });
    } catch {
      throw new ControlPlaneError("Control Plane request failed or timed out.", null, "network_error", true);
    } finally {
      clearTimeout(timer);
    }
  }

  async #readJson<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      throw new ControlPlaneError(payload?.error?.message ?? "Control Plane rejected the request.", response.status, payload?.error?.code ?? null, retryable);
    }
    if (!payload || typeof payload !== "object") throw new ControlPlaneError("Control Plane response was not valid JSON.", response.status, "invalid_response", false);
    return payload as T;
  }
}