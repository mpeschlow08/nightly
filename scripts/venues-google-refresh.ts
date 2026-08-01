import { config } from "dotenv";

config({ path: ".env.local" });

type Args = {
  mode: "single" | "batch" | "stale_only" | "failed_only";
  venueId?: number;
  limit?: number;
  dryRun: boolean;
  force: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: "stale_only",
    dryRun: false,
    force: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      args.force = true;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const mode = arg.slice("--mode=".length) as Args["mode"];
      if (["single", "batch", "stale_only", "failed_only"].includes(mode)) {
        args.mode = mode;
      }
      continue;
    }

    if (arg.startsWith("--venue=")) {
      const value = Number.parseInt(arg.slice("--venue=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        args.venueId = value;
      }
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        args.limit = value;
      }
    }
  }

  if (args.mode === "single" && !args.venueId) {
    throw new Error("--venue=<id> is required in single mode.");
  }

  if (args.venueId && !argv.some((arg) => arg.startsWith("--mode="))) {
    args.mode = "single";
  }

  return args;
}

async function main() {
  const { runVenueGoogleDataRefresh } = await import("@/lib/platform/venue-google-refresh");
  const args = parseArgs(process.argv.slice(2));

  const result = await runVenueGoogleDataRefresh({
    mode: args.mode,
    venueId: args.venueId,
    limit: args.limit,
    dryRun: args.dryRun,
    force: args.force,
    trigger: "script",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "venues-google-refresh failed");
  process.exitCode = 1;
});
