import { getEnvironmentConfigurationStatus } from "@/lib/platform/env";
import { getDatabaseHealth } from "@/lib/platform/db-health";
import { getProviderHealthChecks } from "@/lib/platform/provider-health";
import { db } from "@/db";
import { venueDataRefreshRuns, venues } from "@/db/schema";
import { avg, count, desc, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { getSchedulerState } from "@/lib/platform/venue-google-refresh";

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
  const [environment, database, providers, refreshRuns, staleRows, failedRows] = await Promise.all([
    Promise.resolve(getEnvironmentConfigurationStatus()),
    getDatabaseHealth(),
    getProviderHealthChecks(),
    db
      .select({
        status: venueDataRefreshRuns.status,
        startedAt: venueDataRefreshRuns.startedAt,
        finishedAt: venueDataRefreshRuns.finishedAt,
      })
      .from(venueDataRefreshRuns)
      .orderBy(desc(venueDataRefreshRuns.createdAt))
      .limit(20),
    db
      .select({ count: count() })
      .from(venues)
      .where(or(sql`${venues.googleDataExpiresAt} is null`, lte(venues.googleDataExpiresAt, new Date()))),
    db
      .select({ count: count() })
      .from(venues)
      .where(isNotNull(venues.googleRefreshError)),
  ]);

  const lastSuccessfulPlacesRequest = refreshRuns.find((run) => run.status === "succeeded");
  const lastFailedPlacesRequest = refreshRuns.find((run) => run.status === "failed");
  const queueDepth = refreshRuns.filter((run) => run.status === "queued" || run.status === "running").length;
  const staleVenueCount = staleRows[0]?.count ?? 0;
  const failedVenueCount = failedRows[0]?.count ?? 0;
  const completedDurations = refreshRuns
    .filter((run) => run.startedAt && run.finishedAt)
    .map((run) => run.finishedAt!.getTime() - run.startedAt!.getTime());
  const averageRefreshDurationMs =
    completedDurations.length > 0
      ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
      : null;
  const schedulerState = getSchedulerState();

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
    google_venue_data: {
      status:
        providers.some((provider) => provider.provider === "google_places" && provider.status === "not_configured")
          ? "not_configured"
          : failedVenueCount > 0
            ? "degraded"
            : "healthy",
      detail: `queue=${queueDepth} stale=${staleVenueCount} failed=${failedVenueCount} avgDurationMs=${averageRefreshDurationMs ?? "n/a"}`,
    },
    google_venue_scheduler: {
      status: schedulerState === "configured" ? "healthy" : "not_configured",
      detail: `scheduler=${schedulerState}`,
    },
    google_venue_last_success: {
      status: lastSuccessfulPlacesRequest ? "healthy" : "unknown",
      detail: lastSuccessfulPlacesRequest?.finishedAt?.toISOString() ?? "No successful refresh recorded",
    },
    google_venue_last_failure: {
      status: lastFailedPlacesRequest ? "degraded" : "healthy",
      detail: lastFailedPlacesRequest?.finishedAt?.toISOString() ?? "No failed refresh recorded",
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
