import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getDatabaseHealth } = await import("../lib/platform/db-health");
  const result = await getDatabaseHealth();

  console.log(JSON.stringify(result, null, 2));

  if (result.status === "unavailable") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "db-status failed");
  process.exitCode = 1;
});
