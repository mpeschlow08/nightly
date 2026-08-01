import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  platformBackupVerifications,
  platformBetaCohorts,
  platformIncidents,
  platformFeatureFlags,
  platformLaunchReadinessSnapshots,
  platformReleaseRecords,
  platformSmokeTestRuns,
} from "@/db/schema";
import {
  BETA_V1_DEFERRED_FEATURES,
  BETA_V1_INCLUDED_FEATURES,
  BETA_V1_REQUIRED_FLAG_KEYS,
} from "@/lib/platform/beta-scope";
import { getReadinessReport } from "@/lib/platform/readiness";

export async function getLaunchReadinessSnapshot() {
  const [
    readiness,
    latestRelease,
    latestSmoke,
    latestBackup,
    openCriticalRisks,
    openHighRisks,
    betaCohorts,
    lastSnapshot,
    betaFlags,
  ] = await Promise.all([
    getReadinessReport(),
    db.query.platformReleaseRecords.findFirst({ orderBy: desc(platformReleaseRecords.createdAt) }),
    db.query.platformSmokeTestRuns.findFirst({ orderBy: desc(platformSmokeTestRuns.startedAt) }),
    db.query.platformBackupVerifications.findFirst({ orderBy: desc(platformBackupVerifications.verifiedAt) }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformIncidents)
      .where(eq(platformIncidents.status, "open"))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformIncidents)
      .where(eq(platformIncidents.status, "investigating"))
      .then((rows) => rows[0]?.count ?? 0),
    db.select().from(platformBetaCohorts).orderBy(desc(platformBetaCohorts.updatedAt)).limit(20),
    db.query.platformLaunchReadinessSnapshots.findFirst({ orderBy: desc(platformLaunchReadinessSnapshots.generatedAt) }),
    db
      .select({ key: platformFeatureFlags.key, enabled: platformFeatureFlags.enabled, killSwitch: platformFeatureFlags.killSwitch })
      .from(platformFeatureFlags)
      .where(inArray(platformFeatureFlags.key, [...BETA_V1_REQUIRED_FLAG_KEYS])),
  ]);

  const flagLookup = new Map(betaFlags.map((flag) => [flag.key, flag]));
  const missingBetaFlags = BETA_V1_REQUIRED_FLAG_KEYS.filter((key) => !flagLookup.has(key));
  const deferredFlagsEnabled = BETA_V1_DEFERRED_FEATURES.filter((feature) => {
    if (!feature.flagKey) {
      return false;
    }

    const flag = flagLookup.get(feature.flagKey);

    return Boolean(flag?.enabled && !flag.killSwitch);
  }).map((feature) => feature.flagKey as string);

  const checklist = {
    security: readiness.providers.every((provider) => provider.status !== "unavailable"),
    performance: readiness.database.latencyMs < 1000,
    accessibility: false,
    rollback: Boolean(latestRelease?.rollbackInstructions),
  };

  const releaseStatus = {
    version: latestRelease?.version ?? "unknown",
    commitHash: latestRelease?.commitHash ?? "unknown",
    migrationStatus: latestRelease?.migrationStatus ?? "unknown",
    smokeTestStatus: latestRelease?.smokeTestStatus ?? "unknown",
    goNoGo: latestRelease?.goNoGo ?? "unknown",
    createdAt: latestRelease?.createdAt?.toISOString() ?? null,
  };

  const betaSummary = {
    totalCohorts: betaCohorts.length,
    activeCohorts: betaCohorts.filter((cohort) => cohort.status === "active").length,
    expiringSoon: betaCohorts.filter((cohort) => {
      if (!cohort.expiresAt) return false;
      return cohort.expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
    }).length,
  };

  const blockers = [] as string[];

  if (readiness.status === "not_ready") {
    blockers.push("Core readiness checks are failing.");
  }

  if (openCriticalRisks > 0) {
    blockers.push(`${openCriticalRisks} open critical incident(s).`);
  }

  if (!latestSmoke || latestSmoke.status !== "passed") {
    blockers.push("No recent passing smoke test run recorded.");
  }

  if (missingBetaFlags.length > 0) {
    blockers.push(`Missing beta feature flags: ${missingBetaFlags.join(", ")}`);
  }

  if (deferredFlagsEnabled.length > 0) {
    blockers.push(`Deferred beta flags enabled: ${deferredFlagsEnabled.join(", ")}`);
  }

  const goNoGo = blockers.length === 0 ? "go" : "no_go";

  return {
    generatedAt: new Date().toISOString(),
    readiness,
    releaseStatus,
    latestSmokeTest: latestSmoke
      ? {
          environment: latestSmoke.environment,
          status: latestSmoke.status,
          startedAt: latestSmoke.startedAt.toISOString(),
          completedAt: latestSmoke.completedAt?.toISOString() ?? null,
        }
      : null,
    lastBackupVerification: latestBackup
      ? {
          environment: latestBackup.environment,
          status: latestBackup.status,
          verifiedAt: latestBackup.verifiedAt.toISOString(),
        }
      : null,
    riskSummary: {
      openCriticalRisks,
      openHighRisks,
    },
    betaSummary,
    betaScope: {
      includedFeatures: BETA_V1_INCLUDED_FEATURES,
      deferredFeatures: BETA_V1_DEFERRED_FEATURES,
      requiredFlags: [...BETA_V1_REQUIRED_FLAG_KEYS],
      missingFlags: missingBetaFlags,
      deferredFlagsEnabled,
      coverage: {
        present: betaFlags.length,
        required: BETA_V1_REQUIRED_FLAG_KEYS.length,
      },
    },
    checklist,
    lastSnapshot: lastSnapshot
      ? {
          score: lastSnapshot.score,
          goNoGo: lastSnapshot.goNoGo,
          generatedAt: lastSnapshot.generatedAt.toISOString(),
        }
      : null,
    goNoGo,
    blockers,
  };
}
