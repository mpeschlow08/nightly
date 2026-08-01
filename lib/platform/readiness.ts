import { getEnvironmentConfigurationStatus } from "@/lib/platform/env";
import { getDatabaseHealth } from "@/lib/platform/db-health";
import { getProviderHealthChecks } from "@/lib/platform/provider-health";

export type ReadinessReport = {
  status: "ready" | "degraded" | "not_ready";
  generatedAt: string;
  environment: ReturnType<typeof getEnvironmentConfigurationStatus>;
  database: Awaited<ReturnType<typeof getDatabaseHealth>>;
  providers: Awaited<ReturnType<typeof getProviderHealthChecks>>;
  services: Record<string, { status: "healthy" | "degraded" | "unavailable" | "not_configured" | "unknown"; detail: string }>;
  checks: Array<{ name: string; status: "pass" | "warn" | "fail"; detail: string }>;
};

export async function getReadinessReport(): Promise<ReadinessReport> {
  const [environment, database, providers] = await Promise.all([
    Promise.resolve(getEnvironmentConfigurationStatus()),
    getDatabaseHealth(),
    getProviderHealthChecks(),
  ]);

  const checks: ReadinessReport["checks"] = [
    {
      name: "environment",
      status: environment.ok ? "pass" : "fail",
      detail: environment.ok
        ? "Required environment variables configured"
        : `Missing required variables: ${environment.groups
            .flatMap((group) => group.missingRequired)
            .join(", ")}`,
    },
    {
      name: "database",
      status:
        database.status === "healthy"
          ? "pass"
          : database.status === "degraded"
            ? "warn"
            : "fail",
      detail:
        database.status === "healthy"
          ? "Database connection and key table checks passed"
          : database.errors.join("; "),
    },
    {
      name: "providers",
      status: providers.some((provider) => provider.status === "unavailable")
        ? "fail"
        : providers.some((provider) => provider.status === "degraded" || provider.status === "unknown")
          ? "warn"
          : "pass",
      detail: providers
        .map((provider) => `${provider.provider}:${provider.status}`)
        .join(", "),
    },
  ];

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");

  const services: ReadinessReport["services"] = {
    application: {
      status: "healthy",
      detail: "Application process is responding",
    },
    database: {
      status: database.status,
      detail:
        database.status === "healthy"
          ? "Database checks passed"
          : database.errors.join("; "),
    },
    migration_parity: {
      status: database.migrationLedgerCount > 0 ? "healthy" : "unknown",
      detail: `Migration ledger count: ${database.migrationLedgerCount}`,
    },
    notification_outbox: {
      status: "unknown",
      detail: "Outbox queue depth probe not yet connected",
    },
    webhook_processing: {
      status: providers.some((provider) => provider.provider === "clerk" && provider.status === "not_configured")
        ? "not_configured"
        : "unknown",
      detail: "Webhook delivery state recorded via webhook_deliveries",
    },
    image_proxy: {
      status: providers.some((provider) => provider.provider === "google_places" && provider.status === "not_configured")
        ? "not_configured"
        : "unknown",
      detail: "External image fetch protections active; probe adapter pending",
    },
    camera_live_adapter: {
      status: providers.find((provider) => provider.provider === "camera_live_adapter")?.status ?? "unknown",
      detail: providers.find((provider) => provider.provider === "camera_live_adapter")?.detail ?? "Adapter status unavailable",
    },
  };

  for (const provider of providers) {
    services[provider.provider] = {
      status: provider.status,
      detail: provider.detail,
    };
  }

  return {
    status: hasFail ? "not_ready" : hasWarn ? "degraded" : "ready",
    generatedAt: new Date().toISOString(),
    environment,
    database,
    providers,
    services,
    checks,
  };
}
