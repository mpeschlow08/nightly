import { readFile } from "node:fs/promises";
import { AgentStateMachine } from "./state-machine";
import { ControlPlaneClient, ControlPlaneError } from "./control-plane-client";
import type { CredentialStore } from "./credential-store";
import type { AgentConfig, AgentLogger, AgentPersistentState } from "./types";
import { INITIAL_STATE } from "./types";
import type { AgentStateStore } from "./state-store";
import type { PlatformProbeAdapter } from "../probes/platform";

export type RuntimeDependencies = {
  config: AgentConfig;
  stateStore: AgentStateStore;
  credentialStore: CredentialStore;
  client: ControlPlaneClient;
  probes: PlatformProbeAdapter;
  logger: AgentLogger;
  now?: () => Date;
};

export class AgentRuntime {
  readonly #machine = new AgentStateMachine();
  #state!: AgentPersistentState;
  #stopping = false;
  #wakeDelay: (() => void) | null = null;

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
      ...(stored ?? {}),
      schemaVersion: 1,
      agentState: "STARTING",
      agentVersion: config.agentVersion,
      simulation: config.simulation,
      updatedAt: now,
    };
    await this.#persist();
    await this.#transition("UNPROVISIONED");

    while (!this.#stopping) {
      try {
        await this.#cycle();
      } catch (error) {
        const code = error instanceof ControlPlaneError ? error.code : "agent_cycle_failed";
        this.#state.lastErrorCode = code;
        if (error instanceof ControlPlaneError && error.status === 401) await this.#transition("RECOVERY_REQUIRED");
        else if (error instanceof ControlPlaneError && error.status === 403) await this.#transition("SUSPENDED");
        else if (this.#machine.state !== "RECOVERY_REQUIRED" && this.#machine.state !== "SUSPENDED") await this.#transition("OFFLINE");
        logger.log("warn", "agent_cycle_failed", { code, state: this.#machine.state });
        await this.#persist();
      }
      if (!this.#stopping) await this.#delay(config.heartbeatIntervalMs);
    }

    await this.#transition("STOPPED");
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
    this.#state.deviceId = heartbeat.device.id;
    this.#state.publicDeviceUuid = config.deviceUuid;
    this.#state.lastHeartbeatAt = heartbeatAt;
    this.#state.lastCloudContactAt = heartbeatAt;
    this.#state.lastErrorCode = null;
    if (["suspended", "revoked", "retired"].includes(heartbeat.device.status)) {
      await this.#transition("SUSPENDED");
      await this.#persist();
      return;
    }
    const deviceStatus = await client.getStatus(secret);
    if (deviceStatus.device.managementAccessLevel === "recovery_only") {
      await this.#transition("RECOVERY_ONLY");
      await this.#persist();
      logger.log("info", "agent_recovery_only", { deviceId: deviceStatus.device.id });
      return;
    }
    await this.#transition("ONLINE");
    const configResponse = await client.getConfig(secret);
    if (configResponse.configAvailable && configResponse.configRevision) {
      if (!this.#isValidConfig(configResponse)) throw new ControlPlaneError("Control Plane configuration failed local validation.", null, "invalid_device_config", false);
      this.#state.desiredConfigRevision = configResponse.configRevision;
      this.#state.policyConfig = configResponse;
      this.#state.appliedConfigRevision = configResponse.configRevision;
      await this.#persist();
      await client.acknowledgeConfig(secret, configResponse.configRevision);
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
    return config.ok === true && typeof config.configRevision === "string" && config.configRevision.length > 0 &&
      typeof config.sections?.privacy?.mode === "string" && typeof config.sections.privacy.contentEligibility === "string" &&
      typeof config.sections.privacy.publicPublishingEnabled === "boolean" && Number.isSafeInteger(config.sections.privacy.revision) &&
      typeof config.sections?.service?.entitlementState === "string" && typeof config.sections.service.hotReelEligible === "boolean" &&
      typeof config.sections.service.liveEligible === "boolean" && Number.isSafeInteger(config.sections.service.revision) &&
      typeof config.sections?.recovery?.enabled === "boolean";
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