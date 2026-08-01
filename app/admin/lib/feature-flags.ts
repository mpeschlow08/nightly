import { and, eq, inArray } from "drizzle-orm";

import {
  platformFeatureFlagOverrides,
  platformFeatureFlags,
} from "@/db/schema";

export type FlagEvalContext = {
  environment?: string;
  role?: string;
  userId?: string;
  venueId?: string;
  city?: string;
  percentageSeed?: number;
};

export type FlagState = {
  key: string;
  enabled: boolean;
  source: "global" | "override" | "killswitch" | "missing";
};

function parsePercentageSeed(seed?: number) {
  if (typeof seed !== "number" || Number.isNaN(seed)) {
    return null;
  }

  const normalized = Math.abs(Math.floor(seed % 100));
  return normalized;
}

export function evaluateFlagState(input: {
  key: string;
  enabled: boolean;
  killSwitch: boolean;
  rolloutPercentage: number;
  overrides: Array<{ scope: string; scopeValue: string; enabled: boolean }>;
  context: FlagEvalContext;
}): FlagState {
  if (input.killSwitch) {
    return { key: input.key, enabled: false, source: "killswitch" };
  }

  const ctx = input.context;
  const scopePairs: Array<[string, string | undefined]> = [
    ["user", ctx.userId],
    ["venue", ctx.venueId],
    ["role", ctx.role],
    ["city", ctx.city],
    ["environment", ctx.environment],
  ];

  for (const [scope, value] of scopePairs) {
    if (!value) {
      continue;
    }

    const match = input.overrides.find((row) => row.scope === scope && row.scopeValue === value);
    if (match) {
      return { key: input.key, enabled: match.enabled, source: "override" };
    }
  }

  if (input.rolloutPercentage > 0 && input.rolloutPercentage < 100) {
    const seed = parsePercentageSeed(ctx.percentageSeed);
    const enabled = seed != null ? seed < input.rolloutPercentage : false;
    return { key: input.key, enabled, source: "override" };
  }

  return { key: input.key, enabled: input.enabled, source: "global" };
}

export async function getServerFeatureFlagState(
  key: string,
  context: FlagEvalContext
): Promise<FlagState> {
  const { db } = await import("@/db");

  const row = await db.query.platformFeatureFlags.findFirst({
    where: eq(platformFeatureFlags.key, key),
  });

  if (!row) {
    return { key, enabled: false, source: "missing" };
  }

  const scopeValues = [context.userId, context.venueId, context.role, context.city, context.environment].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  const overrides =
    scopeValues.length === 0
      ? []
      : await db
          .select({
            scope: platformFeatureFlagOverrides.scope,
            scopeValue: platformFeatureFlagOverrides.scopeValue,
            enabled: platformFeatureFlagOverrides.enabled,
          })
          .from(platformFeatureFlagOverrides)
          .where(
            and(
              eq(platformFeatureFlagOverrides.flagId, row.id),
              inArray(platformFeatureFlagOverrides.scopeValue, scopeValues)
            )
          );

  return evaluateFlagState({
    key,
    enabled: row.enabled,
    killSwitch: row.killSwitch,
    rolloutPercentage: row.rolloutPercentage,
    overrides,
    context,
  });
}
