import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import { CertificationManifestStore } from "../tests/helpers/nightly-device-cert-manifest";

config({ path: ".env.local", override: true, quiet: true });
delete process.env.PGOPTIONS;

async function main() {
  const manifestDirectory = join(tmpdir(), "nightly-device-api-certification");
  const manifests = (await readdir(manifestDirectory).catch(() => [])).filter((name) => name.endsWith(".json") && !name.endsWith("-result.json"));
  if (manifests.length === 0) {
    console.log(JSON.stringify({ manifests: 0, message: "No interrupted certification manifests found." }));
    return;
  }

  const [{ db }, { and, eq, inArray, like, sql }, schema, clerkServer] = await Promise.all([
    import("../db"),
    import("drizzle-orm"),
    import("../db/schema"),
    import("@clerk/nextjs/server"),
  ]);
  const url = new URL(process.env.DATABASE_URL ?? "");
  const identity = await db.execute(sql.raw("select current_database() as database_name,current_setting('neon.project_id',true) as project_id,current_setting('neon.branch_id',true) as branch_id,current_setting('neon.endpoint_id',true) as endpoint_id"));
  const row = identity.rows[0];
  if (!url.hostname.startsWith("ep-silent-hat-") || row?.project_id !== "old-tooth-16761666" || row?.branch_id !== "br-tiny-recipe-atpyb85n" || row?.endpoint_id !== "ep-silent-hat-at3rhpgq" || row?.database_name !== "neondb") {
    throw new Error("Development identity guard failed; no certification cleanup performed.");
  }

  const clerk = await clerkServer.clerkClient();
  const results: Array<Record<string, unknown>> = [];
  for (const name of manifests) {
    const path = join(manifestDirectory, name);
    const manifest = await CertificationManifestStore.read(path);
    const devices = await db.select({ id: schema.nightlyDevices.id }).from(schema.nightlyDevices)
      .where(like(schema.nightlyDevices.serialNumber, `${manifest.fixturePrefix}%`));
    const ids = [...new Set([...devices.map((device) => device.id), ...manifest.deviceIds])];
    await db.transaction(async (tx) => {
      if (ids.length) {
        await tx.delete(schema.auditLogs).where(and(
          eq(schema.auditLogs.entityType, "nightly_device"),
          inArray(schema.auditLogs.entityId, ids.map(String)),
        ));
        await tx.delete(schema.nightlyDevices).where(inArray(schema.nightlyDevices.id, ids));
      }
      await tx.delete(schema.venueCameras).where(like(schema.venueCameras.name, `${manifest.fixturePrefix}%`));
      await tx.delete(schema.venueStaffProfiles).where(and(
        eq(schema.venueStaffProfiles.firstName, "Nightly"),
        eq(schema.venueStaffProfiles.lastName, "Certification Operator"),
        eq(schema.venueStaffProfiles.jobTitle, "Tech Operator Certification Fixture"),
        like(schema.venueStaffProfiles.email, `${manifest.fixturePrefix.toLowerCase()}%@invalid.example`),
      ));
    });

    const revoked: string[] = [];
    const failed: string[] = [];
    for (const sessionId of manifest.sessionIds) {
      try { await clerk.sessions.revokeSession(sessionId); revoked.push(sessionId); } catch { failed.push(sessionId); }
    }
    const pendingSessionIntent = manifest.pendingSessionUserId !== null;
    if (failed.length === 0 && !pendingSessionIntent) await rm(path, { force: true });
    results.push({ runId: manifest.runId, deviceFixturesRemoved: ids.length, knownSessionsRevoked: revoked.length, failedSessionCount: failed.length, pendingSessionIntent });
  }
  console.log(JSON.stringify({ identity: "verified-development", results }));
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Certification recovery failed.");
  process.exitCode = 1;
});