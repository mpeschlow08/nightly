import { join } from "node:path";
import { loadAgentConfig } from "./core/config";
import { EncryptedFileCredentialStore, loadEncryptionKey, TpmCredentialStore } from "./core/credential-store";
import { ControlPlaneClient } from "./core/control-plane-client";
import { JsonLineLogger } from "./core/logger";
import { AgentRuntime } from "./core/runtime";
import { FileAgentStateStore } from "./core/state-store";
import { notifySystemd, startSystemdWatchdog } from "./core/systemd-notify";
import { LinuxProbeAdapter, SimulationProbeAdapter } from "./probes/linux";

async function main() {
  const config = loadAgentConfig();
  if (!config.deviceUuid || !config.serialNumber) throw new Error("NIGHTLY_DEVICE_UUID and NIGHTLY_SERIAL_NUMBER are required.");
  const logger = new JsonLineLogger();
  const credentialDirectory = process.env.CREDENTIALS_DIRECTORY;
  const credentialKeyPath = credentialDirectory ? join(credentialDirectory, "credential-key") : "";
  const key = credentialKeyPath ? await loadEncryptionKey(credentialKeyPath) : null;
  const credentialStore = key
    ? new EncryptedFileCredentialStore(join(config.stateDirectory, "device-credential.enc"), key)
    : new TpmCredentialStore(async () => false);
  const client = new ControlPlaneClient({
    baseUrl: config.controlPlaneUrl,
    deviceUuid: config.deviceUuid,
    requestTimeoutMs: config.requestTimeoutMs,
    retryBaseMs: config.retryBaseMs,
    retryMaxMs: config.retryMaxMs,
  });
  const runtime = new AgentRuntime({
    config,
    stateStore: new FileAgentStateStore(config.stateDirectory),
    credentialStore,
    client,
    probes: config.simulation ? new SimulationProbeAdapter() : new LinuxProbeAdapter(),
    logger,
  });
  const stopWatchdog = startSystemdWatchdog();
  await notifySystemd("READY=1\nSTATUS=Nightly Agent started");
  const shutdown = () => runtime.stop();
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  try { await runtime.run(); } finally { stopWatchdog(); await notifySystemd("STOPPING=1"); }
}

main().catch((error: unknown) => {
  const logger = new JsonLineLogger();
  logger.log("error", "agent_start_failed", { message: error instanceof Error ? error.message : "unknown_error" });
  process.exitCode = 1;
});