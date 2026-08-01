import { config } from "dotenv";

import { validateEnvironment } from "../lib/platform/env";

config({ path: ".env.local" });

function main() {
  const report = validateEnvironment();

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
