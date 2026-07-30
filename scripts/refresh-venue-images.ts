import { config } from "dotenv";

config({ path: ".env.local" });

type Args = {
  dryRun: boolean;
  force: boolean;
  limit: number;
  venueId: number | null;
};

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let force = false;
  let limit = 10;
  let venueId: number | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        limit = value;
      }
      continue;
    }

    if (arg.startsWith("--venue=")) {
      const value = Number.parseInt(arg.slice("--venue=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        venueId = value;
      }
      continue;
    }
  }

  return {
    dryRun,
    force,
    limit: Math.min(Math.max(limit, 1), 100),
    venueId,
  };
}

type RefreshDeps = {
  db: (typeof import("@/db"))["db"];
  venues: (typeof import("@/db/schema"))["venues"];
  eq: (typeof import("drizzle-orm"))["eq"];
  listVenuesNeedingImageRefresh: (typeof import("@/app/owner/lib/venue-image-import"))["listVenuesNeedingImageRefresh"];
  refreshVenueImagesForVenue: (typeof import("@/app/owner/lib/venue-image-import"))["refreshVenueImagesForVenue"];
};

async function resolveTargetVenueIds(args: Args, deps: RefreshDeps) {
  if (args.venueId) {
    const [venue] = await deps.db
      .select({ id: deps.venues.id })
      .from(deps.venues)
      .where(deps.eq(deps.venues.id, args.venueId))
      .limit(1);

    if (!venue) {
      throw new Error(`Venue ${args.venueId} was not found.`);
    }

    return [venue.id];
  }

  const candidates = await deps.listVenuesNeedingImageRefresh(args.limit);
  return candidates.map((candidate) => candidate.id);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const [{ db }, { venues }, { eq }, imageImport] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("drizzle-orm"),
    import("@/app/owner/lib/venue-image-import"),
  ]);

  const deps: RefreshDeps = {
    db,
    venues,
    eq,
    listVenuesNeedingImageRefresh: imageImport.listVenuesNeedingImageRefresh,
    refreshVenueImagesForVenue: imageImport.refreshVenueImagesForVenue,
  };

  const venueIds = await resolveTargetVenueIds(args, deps);

  if (venueIds.length === 0) {
    console.log("No venues require image refresh.");
    return;
  }

  console.log(
    `Running venue image refresh for ${venueIds.length} venue(s)${args.dryRun ? " (dry run)" : ""}${args.force ? " with force" : ""}.`
  );

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const venueId of venueIds) {
    const result = await deps.refreshVenueImagesForVenue({
      venueId,
      dryRun: args.dryRun,
      force: args.force,
    });

    if (result.status === "success") {
      success += 1;
      console.log(`[success] venue=${result.venueId} name=${result.venueName} reason=${result.reason}`);
      continue;
    }

    if (result.status === "skipped") {
      skipped += 1;
      console.log(`[skipped] venue=${result.venueId} name=${result.venueName} reason=${result.reason}`);
      continue;
    }

    failed += 1;
    console.log(`[failed] venue=${result.venueId} name=${result.venueName} reason=${result.reason}`);
  }

  console.log(`Summary: success=${success} skipped=${skipped} failed=${failed} total=${venueIds.length}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown failure";
  console.error(`Venue image refresh failed: ${message}`);
  process.exitCode = 1;
});
