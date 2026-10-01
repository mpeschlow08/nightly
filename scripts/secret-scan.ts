import { scanTrackedFiles } from "../lib/platform/secret-scan";

function main() {
  const report = scanTrackedFiles();

  console.log(JSON.stringify(report, null, 2));

  if (report.findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
