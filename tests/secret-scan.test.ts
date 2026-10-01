import assert from "node:assert/strict";
import test from "node:test";

import { scanTrackedFiles } from "../lib/platform/secret-scan";

test("secret scan covers tracked text source without reading local environment files", () => {
  const report = scanTrackedFiles();

  assert.ok(report.filesScanned > 5);
  assert.equal(report.findings.some((finding) => finding.file === ".env.local"), false);
  assert.equal(report.findings.some((finding) => finding.file.includes("node_modules/")), false);
});