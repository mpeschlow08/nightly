import { readFileSync } from "node:fs";
import { join } from "node:path";

const suspiciousPatterns: Array<{ name: string; regex: RegExp }> = [
  { name: "private_key_block", regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/i },
  { name: "aws_access_key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "generic_secret_assignment", regex: /(secret|token|password|api[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/i },
  { name: "database_url_literal", regex: /postgres(?:ql)?:\/\/[\w.-]+:[^\s@]+@/i },
];

const filesToScan = [
  ".env.example",
  "README.md",
  "package.json",
  "next.config.ts",
  "proxy.ts",
];

function main() {
  const findings: Array<{ file: string; pattern: string }> = [];

  for (const relativePath of filesToScan) {
    const fullPath = join(process.cwd(), relativePath);
    const content = readFileSync(fullPath, "utf8");

    for (const pattern of suspiciousPatterns) {
      if (pattern.regex.test(content)) {
        findings.push({ file: relativePath, pattern: pattern.name });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        filesScanned: filesToScan.length,
        findings,
      },
      null,
      2
    )
  );

  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
