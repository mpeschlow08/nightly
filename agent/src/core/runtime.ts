import { readFile } from "node:fs/promises";
import { AgentStateMachine } from "./state-machine";
import { ControlPlaneClient, ControlPlaneError } from "./control-plane-client";
import type { CredentialStore } from "./credential-store";
import type { AgentConfig, AgentLogger, AgentPersistentState } from "./types";
import { INITIAL_STATE } from "./types";
import type { AgentStateStore } from "./state-store";
import type { PlatformProbeAdapter } from "../probes/platform";
import type { AgentMediaRuntime } from "../media/runtime";
import type { DeviceMediaBindings } from "../media/device-bindings";

export type RuntimeDependencies = {
  config: AgentConfig;
  stateStore: AgentStateStore;
  credentialStore: CredentialStore;
  client: ControlPlaneClient;
  probes: PlatformProbeAdapter;
  logger: AgentLogger;
  media?: AgentMediaRuntime;
  mediaBindings?: DeviceMediaBindings;
  now?: () => Date;
};

export class AgentRuntime {
  readonly #machine = new AgentStateMachine();
  #state!: AgentPersistentState;
  #stopping = false;
  #wakeDelay: (() => void) | null = null;
  #mediaExpiry: NodeJS.Timeout | null = null;

  constructor(private readonly dependencies: RuntimeDependencies) {}

  get state() { return this.#machine.state; }

  stop() {
    this.#stopping = true;
    this.#wakeDelay?.();
  }

  async run() {
    const { config, stateStore, logger } = this.dependencies;
    const stored = await stateStore.load();
    const now = (this.dependencies.now ?? (() => new Date()))().toISOString();
    this.#state = {
      ...INITIAL_STATE,
      deviceId: Number.isSafeInteger(stored?.deviceId) && stored!.deviceId! > 0 ? stored!.deviceId : null,
      publicDeviceUuid: typeof stored?.publicDeviceUuid === "string" ? stored.publicDeviceUuid : null,
      serialNumber: typeof stored?.serialNumber === "string" ? stored.serialNumber : null,
      softwareVersion: typeof stored?.softwareVersion === "string" ? stored.softwareVersion : null,
      desiredConfigRevision: typeof stored?.desiredConfigRevision === "string" ? stored.desiredConfigRevision : null,
      appliedConfigRevision: typeof stored?.appliedConfigRevision === "string" ? stored.appliedConfigRevision : null,
      lastCloudContactAt: typeof stored?.lastCloudContactAt === "string" ? stored.lastCloudContactAt : null,
      lastHeartbeatAt: typeof stored?.lastHeartbeatAt === "string" ? stored.lastHeartbeatAt : null,
      lastErrorCode: typeof stored?.lastErrorCode === "string" ? stored.lastErrorCode : null,
      policyConfig: null,
      schemaVersion: 1,
      agentState: "STARTING",
      agentVersion: config.agentVersion,
      simulation: config.simulation,
      updatedAt: now,
    };
    await this.#persist();
    await this.#transition(this.#state.deviceId !== null ? "AUTHENTICATING" : "UNPROVISIONED");

    try {
    while (!this.#stopping) {
      try {
        await this.#cycle();
      } catch (error) {
        const code = error instanceof ControlPlaneError ? error.code : "agent_cycle_failed";
        this.#state.lastErrorCode = code;
        if (error instanceof ControlPlaneError && (error.status === 401 || error.status === 403 || error.status === 409) ||
          !(error instanceof ControlPlaneError && error.retryable)) await this.#stopMedia();
        else if (this.dependencies.mediaBindings && (this.dependencies.now ?? (() => new Date()))().getTime() >= this.dependencies.mediaBindings.expiresAt) await this.#stopMedia();
        if (error instanceof ControlPlaneError && error.status === 401) await this.#transition("RECOVERY_REQUIRED");
        else if (error instanceof ControlPlaneError && error.status === 403) await this.#transition("SUSPENDED");
        else if (this.#machine.state === "UNPROVISIONED") await this.#transition("RECOVERY_REQUIRED");
        else if (this.#machine.state !== "RECOVERY_REQUIRED" && this.#machine.state !== "SUSPENDED") await this.#transition("OFFLINE");
        logger.log("warn", "agent_cycle_failed", { code, state: this.#machine.state });
        await this.#persist();
      }
      if (!this.#stopping) await this.#delay(config.heartbeatIntervalMs);
    }

    } finally {
      await this.#stopMedia();
      await this.#transition("STOPPED");
    }
  }

  async #cycle() {
    const { config, credentialStore, client, probes, logger } = this.dependencies;
    let credentials;
    try {
      credentials = await credentialStore.load();
    } catch {
      this.#state.lastErrorCode = "credential_store_unavailable";
      if (this.#state.deviceId !== null) await this.#transition("RECOVERY_REQUIRED");
      else await this.#persist();
      return;
    }
    if (!credentials) {
      if (this.#machine.state === "RECOVERY_REQUIRED" || this.#state.deviceId !== null) {
        if (this.#machine.state !== "RECOVERY_REQUIRED") await this.#transition("RECOVERY_REQUIRED");
        return;
      }
      await this.#transition("BOOTSTRAPPING");
      const bootstrapToken = await this.#readBootstrapToken();
      if (!bootstrapToken) {
        await this.#transition("UNPROVISIONED");
        this.#state.lastErrorCode = "bootstrap_credential_missing";
        await this.#persist();
        return;
      }
      try {
        const device = await client.bootstrap({ publicDeviceUuid: config.deviceUuid, serialNumber: config.serialNumber, bootstrapToken }, async (deviceSecret) => credentialStore.save({ deviceSecret }));
        if (device.publicDeviceUuid !== config.deviceUuid || device.serialNumber !== config.serialNumber) throw new ControlPlaneError("Bootstrap identity mismatch.", null, "device_identity_mismatch", false);
        credentials = { deviceSecret: "persisted" };
        this.#state.deviceId = device.id;
        this.#state.publicDeviceUuid = device.publicDeviceUuid;
        this.#state.serialNumber = device.serialNumber;
        this.#state.lastErrorCode = null;
        await this.#transition("AUTHENTICATING");
        logger.log("info", "device_bootstrapped", { deviceId: device.id });
      } catch (error) {
        this.#state.lastErrorCode = error instanceof ControlPlaneError ? error.code : "bootstrap_failed";
        await this.#transition("RECOVERY_REQUIRED");
        await this.#persist();
        return;
      }
    }

    const secret = credentials.deviceSecret === "persisted" ? (await credentialStore.load())?.deviceSecret : credentials.deviceSecret;
    if (!secret) throw new ControlPlaneError("Persisted device credential is unavailable.", null, "credential_unavailable", false);
    const reportDegraded = this.#machine.state === "DEGRADED";
    if (this.#machine.state === "UNPROVISIONED" || this.#machine.state === "RECOVERY_REQUIRED") {
      await this.#transition("AUTHENTICATING");
    }
    await this.#transition("CONNECTING");
    const heartbeatAt = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const heartbeat = await client.heartbeat(secret, {
      agentVersion: config.agentVersion,
      ...(config.softwareVersion ? { softwareVersion: config.softwareVersion } : {}),
      operationalState: reportDegraded ? "degraded" : "healthy",
    });
    if (!Number.isSafeInteger(heartbeat.device?.id) || heartbeat.device.id <= 0 || heartbeat.device.uuid !== config.deviceUuid ||
      (this.#state.deviceId !== null && this.#state.deviceId !== heartbeat.device.id)) throw new ControlPlaneError("Device identity mismatch.", null, "device_identity_mismatch", false);
    this.#state.deviceId = heartbeat.device.id;
    this.#state.publicDeviceUuid = config.deviceUuid;
    this.#state.lastHeartbeatAt = heartbeatAt;
    this.#state.lastCloudContactAt = heartbeatAt;
    this.#state.lastErrorCode = null;
    if (heartbeat.device.status !== "active") {
      await this.#stopMedia();
      await this.#transition("SUSPENDED");
      await this.#persist();
      return;
    }
    const deviceStatus = await client.getStatus(secret);
    if (deviceStatus.device?.id !== heartbeat.device.id || deviceStatus.device.uuid !== config.deviceUuid ||
        deviceStatus.device.venueId !== heartbeat.device.venueId) throw new ControlPlaneError("Device identity mismatch.", null, "device_identity_mismatch", false);
    if (deviceStatus.device.managementAccessLevel === "recovery_only") {
      await this.#stopMedia();
      await this.#transition("RECOVERY_ONLY");
      await this.#persist();
      logger.log("info", "agent_recovery_only", { deviceId: deviceStatus.device.id });
      return;
    }
    if (deviceStatus.device.managementAccessLevel !== "owner_assisted" && deviceStatus.device.managementAccessLevel !== "nightly_managed") throw new ControlPlaneError("Device management unavailable.", 403, "device_unavailable", false);
    await this.#transition("ONLINE");
    const configResponse = await client.getConfig(secret);
    if (configResponse.deviceId !== heartbeat.device.id || configResponse.venueId !== heartbeat.device.venueId) throw new ControlPlaneError("Device configuration identity mismatch.", null, "invalid_device_config", false);
    if (configResponse.configAvailable && !configResponse.configRevision) throw new ControlPlaneError("Device configuration revision missing.", null, "invalid_device_config", false);
    if (!configResponse.configAvailable) {
      await this.#stopMedia();
      this.#state.desiredConfigRevision = null;
      this.#state.appliedConfigRevision = null;
    }
    if (configResponse.configAvailable && configResponse.configRevision) {
      if (!this.#isValidConfig(configResponse)) throw new ControlPlaneError("Control Plane configuration failed local validation.", null, "invalid_device_config", false);
      if (this.dependencies.mediaBindings) {
        try {
          if (heartbeat.device.venueId === null) throw new Error("media_venue_missing");
          if (this.dependencies.mediaBindings.revision && this.dependencies.mediaBindings.revision !== configResponse.configRevision) await this.dependencies.media?.stop();
          this.dependencies.mediaBindings.bindIdentity(heartbeat.device.id, heartbeat.device.venueId);
          this.dependencies.mediaBindings.update(configResponse);
          this.#armMediaExpiry();
        } catch { throw new ControlPlaneError("Device media configuration failed validation.", null, "invalid_device_config", false); }
      }
      this.#state.desiredConfigRevision = configResponse.configRevision;
      this.#state.policyConfig = null;
      this.#state.appliedConfigRevision = configResponse.configRevision;
      await this.#persist();
      await client.acknowledgeConfig(secret, configResponse.configRevision);
    }
    if (this.dependencies.media) {
      const policy = configResponse.sections;
      if (configResponse.configAvailable && policy.service.entitlementState === "active" && policy.service.hotReelEligible &&
          policy.privacy.contentEligibility === "approved" && policy.privacy.publicPublishingEnabled && policy.privacy.mode !== "restricted") {
        await this.dependencies.media.start();
        await this.dependencies.media.reconcile();
      } else await this.#stopMedia();
    }
    const discovery = await probes.discover(config);
    if (!config.simulation) {
      await client.replaceCapabilities(secret, discovery.capabilities);
      if (heartbeat.device.venueId !== null) await client.replaceInventory(secret, discovery.inventory);
      await client.reportCommissioning(secret, discovery.commissioning);
    }
    const degraded = discovery.probes.some((probe) => probe.status === "warning" || probe.status === "fail");
    if (degraded) await this.#transition("DEGRADED");
    if (config.softwareVersion) this.#state.softwareVersion = config.softwareVersion;
    this.#state.lastCloudContactAt = (this.dependencies.now ?? (() => new Date()))().toISOString();
    this.#state.lastErrorCode = null;
    await this.#persist();
    logger.log("info", "agent_cycle_complete", { state: this.#machine.state, sourceCount: discovery.inventory.sources.length, capabilityCount: discovery.capabilities.capabilities.length, commissioningCount: discovery.commissioning.checks.length, simulation: config.simulation });
  }

  async #readBootstrapToken() {
    const directory = process.env.CREDENTIALS_DIRECTORY;
    if (!directory) return null;
    const token = (await readFile(`${directory}/bootstrap-token`, "utf8").catch(() => "")).trim();
    return token.length >= 32 && token.length <= 256 && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
  }

  #isValidConfig(config: Awaited<ReturnType<RuntimeDependencies["client"]["getConfig"]>>) {
    return config.ok === true && typeof config.configRevision === "string" && config.configRevision.length > 0 && config.configRevision.length <= 128 &&
      config.sections?.media?.revision === config.configRevision && config.sections.media.ttlSeconds === 300 && Array.isArray(config.sections.media.sources) &&
      typeof config.sections?.privacy?.mode === "string" && typeof config.sections.privacy.contentEligibility === "string" &&
      typeof config.sections.privacy.publicPublishingEnabled === "boolean" && Number.isSafeInteger(config.sections.privacy.revision) &&
      typeof config.sections?.service?.entitlementState === "string" && typeof config.sections.service.hotReelEligible === "boolean" &&
      typeof config.sections.service.liveEligible === "boolean" && Number.isSafeInteger(config.sections.service.revision) &&
      typeof config.sections?.recovery?.enabled === "boolean";
  }

  #armMediaExpiry() {
    if (this.#mediaExpiry) clearTimeout(this.#mediaExpiry);
    const expiresAt = this.dependencies.mediaBindings?.expiresAt ?? 0;
    this.#mediaExpiry = setTimeout(() => {
      this.#mediaExpiry = null;
      if ((this.dependencies.now ?? (() => new Date()))().getTime() >= expiresAt) void this.#stopMedia().catch(() => undefined);
    }, Math.max(0, expiresAt - (this.dependencies.now ?? (() => new Date()))().getTime()));
  }

  async #stopMedia() {
    if (this.#mediaExpiry) clearTimeout(this.#mediaExpiry);
    this.#mediaExpiry = null;
    this.dependencies.mediaBindings?.clear();
    await this.dependencies.media?.stop();
  }

  async #transition(next: AgentPersistentState["agentState"]) {
    if (this.#machine.state !== next) this.#machine.transition(next);
    this.#state.agentState = next;
    this.#state.updatedAt = (this.dependencies.now ?? (() => new Date()))().toISOString();
    await this.#persist();
  }

  async #persist() {
    await this.dependencies.stateStore.save(this.#state);
  }

  async #delay(ms: number) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { this.#wakeDelay = null; resolve(); }, ms);
      this.#wakeDelay = () => { clearTimeout(timer); this.#wakeDelay = null; resolve(); };
      if (this.#stopping) this.#wakeDelay();
    });
  }
}