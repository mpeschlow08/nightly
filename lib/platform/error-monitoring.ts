import { logger } from "@/lib/platform/logger";

export type MonitoringContext = {
  requestId?: string;
  correlationId?: string;
  route?: string;
  action?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
};

export type MonitoringAdapter = {
  name: string;
  configured: boolean;
  capture(error: unknown, context?: MonitoringContext): Promise<void>;
};

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error",
  };
}

export function createMonitoringAdapter(): MonitoringAdapter {
  const provider = process.env.ERROR_MONITORING_PROVIDER?.trim().toLowerCase() ?? "none";

  return {
    name: provider,
    configured: provider !== "none" && provider.length > 0,
    async capture(error, context) {
      const normalized = normalizeError(error);

      logger.error("error_captured", {
        route: context?.route,
        action: context?.action,
        requestId: context?.requestId,
        correlationId: context?.correlationId,
        provider: provider,
        error: normalized,
        metadata: context?.metadata,
      });
    },
  };
}

export const monitoring = createMonitoringAdapter();
