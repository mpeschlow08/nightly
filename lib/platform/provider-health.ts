import { getEnvironment } from "@/lib/platform/env";

export type ProviderHealthStatus = "healthy" | "degraded" | "unavailable" | "not_configured" | "unknown";

export type ProviderHealthCheck = {
  provider: string;
  status: ProviderHealthStatus;
  configured: boolean;
  detail: string;
};

function configured(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function checkConfigured(provider: string, keys: string[]): ProviderHealthCheck {
  const hasAll = keys.every((key) => configured(process.env[key]));

  return {
    provider,
    status: hasAll ? "unknown" : "not_configured",
    configured: hasAll,
    detail: hasAll
      ? "Configured but not actively probed by this endpoint"
      : `Missing required configuration: ${keys.filter((key) => !configured(process.env[key])).join(", ")}`,
  };
}

function checkSigningSecret(provider: string, key: string): ProviderHealthCheck {
  const hasSecret = configured(process.env[key]);

  return {
    provider,
    status: hasSecret ? "unknown" : "not_configured",
    configured: hasSecret,
    detail: hasSecret ? "Signing secret configured" : `Missing signing secret: ${key}`,
  };
}

export async function getProviderHealthChecks() {
  const env = getEnvironment();

  const checks: ProviderHealthCheck[] = [
    checkConfigured("clerk", ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]),
    checkConfigured("vercel_blob", ["PUBLIC_BLOB_STORE_ID", "PUBLIC_BLOB_READ_WRITE_TOKEN"]),
    checkConfigured("google_places", ["GOOGLE_PLACES_API_KEY"]),
    checkSigningSecret("ticket_signing", "TICKET_TOKEN_SECRET"),
    checkSigningSecret("social_signing", "SOCIAL_TOKEN_SECRET"),
    checkConfigured("error_monitoring", ["ERROR_MONITORING_PROVIDER"]),
    checkConfigured("payments", ["PAYMENT_PROVIDER"]),
    checkConfigured("email", ["EMAIL_PROVIDER"]),
    checkConfigured("push", ["PUSH_PROVIDER"]),
    checkConfigured("sms", ["SMS_PROVIDER"]),
    checkConfigured("ai", ["VENUE_INTELLIGENCE_AI_PROVIDER"]),
    checkConfigured("realtime", ["REALTIME_PROVIDER"]),
    checkConfigured("job_scheduler", ["JOB_SCHEDULER_PROVIDER"]),
    checkConfigured("wallet_passes", ["WALLET_PASS_PROVIDER"]),
    checkConfigured("camera_live_adapter", ["CAMERA_LIVE_PROVIDER"]),
  ];

  // In production-like envs, treat unconfigured critical providers as unavailable for readiness.
  if (env === "production" || env === "staging" || env === "preview") {
    for (const check of checks) {
      if (check.provider === "clerk" && check.status === "not_configured") {
        check.status = "unavailable";
      }
      if (check.provider === "ticket_signing" && check.status === "not_configured") {
        check.status = "unavailable";
      }
      if (check.provider === "social_signing" && check.status === "not_configured") {
        check.status = "unavailable";
      }
    }
  }

  return checks;
}
