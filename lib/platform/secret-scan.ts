import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const suspiciousPatterns: Array<{ name: string; regex: RegExp }> = [
  { name: "private_key_block", regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/i },
  { name: "aws_access_key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "database_url_literal", regex: new RegExp(["postgres(?:ql)?", "://", "[^\\s:@]+", ":", "[^\\s@]+", "@"].join(""), "i") },
  { name: "generic_secret_assignment", regex: /(?:secret|token|password|api[_-]?key)\s*[:=]\s*["'][^"']{16,}["']/i },
];

const textExtensions = new Set([
  ".cjs", ".css", ".js", ".json", ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

function isScannablePath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.startsWith(".env") || normalized.startsWith(".next/") || normalized.startsWith("node_modules/") || normalized.startsWith("reports/") || normalized.startsWith("tmp/")) {
    return false;
  }
  return textExtensions.has(extname(normalized).toLowerCase());
}

export function scanTrackedFiles(root = process.cwd()) {
  let candidateFiles: string[];
  try {
    candidateFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0");
  } catch {
    candidateFiles = collectSourceFiles(root);
  }
  const trackedFiles = candidateFiles.filter((file): file is string => Boolean(file) && isScannablePath(file));
  const findings: Array<{ file: string; pattern: string }> = [];

  for (const relativePath of trackedFiles) {
    if (relativePath === "lib/platform/secret-scan.ts") continue;
    const content = readFileSync(join(root, relativePath), "utf8");
    for (const pattern of suspiciousPatterns) {
      const match = content.match(pattern.regex);
      if (!match || isKnownSyntheticFixture(relativePath, match[0])) continue;
      findings.push({ file: relativePath, pattern: pattern.name });
    }
  }

  return { filesScanned: trackedFiles.length, findings };
}

function isKnownSyntheticFixture(relativePath: string, match: string) {
  const normalized = relativePath.replaceAll("\\", "/");
  const lowerMatch = match.toLowerCase();
  if (normalized === ".github/workflows/ci.yml" || lowerMatch.includes("postgresql://ci:ci@localhost")) return true;
  if (normalized === "tests/platform-logger.test.ts" || normalized === "tests/nightly-device-cert-manifest.test.ts") return true;
  if (!normalized.includes("/tests/") && !normalized.startsWith("tests/")) return false;
  return ["synthetic", "fixture", "test-", "test_", "test-secret", "test-password", "cf_api_token_secret", "mux-token-secret-secret"].some((marker) => lowerMatch.includes(marker));
}

function collectSourceFiles(root: string, relativeDirectory = ""): string[] {
  const directory = join(root, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if ([".git", ".next", "node_modules", "reports", "tmp"].includes(entry.name)) return [];
      return collectSourceFiles(root, relativePath);
    }
    return [relativePath];
  });
}