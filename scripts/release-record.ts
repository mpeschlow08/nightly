import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db");
  const { platformReleaseRecords } = await import("../db/schema");

  const version = process.env.RELEASE_VERSION?.trim() || "unversioned";
  const commitHash = process.env.RELEASE_COMMIT?.trim() || "unknown";
  const environment = process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
  const migrationStatus = process.env.RELEASE_MIGRATION_STATUS?.trim() || "unknown";
  const goNoGo = process.env.RELEASE_GO_NO_GO?.trim() || "unknown";

  const [record] = await db
    .insert(platformReleaseRecords)
    .values({
      version,
      commitHash,
      environment,
      migrationStatus,
      smokeTestStatus: process.env.RELEASE_SMOKE_STATUS?.trim() || "unknown",
      goNoGo,
      rollbackInstructions: process.env.RELEASE_ROLLBACK?.trim() || "Rollback to prior known-good build and re-run db:verify.",
      featureFlagSnapshotJson: process.env.RELEASE_FEATURE_FLAGS_JSON?.trim() || "{}",
      providerStatusJson: process.env.RELEASE_PROVIDER_STATUS_JSON?.trim() || "{}",
      knownIssuesJson: process.env.RELEASE_KNOWN_ISSUES_JSON?.trim() || "[]",
      approvedByClerkUserId: process.env.RELEASE_APPROVED_BY?.trim() || null,
    })
    .returning({ id: platformReleaseRecords.id, createdAt: platformReleaseRecords.createdAt });

  console.log(
    JSON.stringify(
      {
        id: record.id,
        createdAt: record.createdAt,
        version,
        commitHash,
        environment,
        migrationStatus,
        goNoGo,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "release-record failed");
  process.exitCode = 1;
});
