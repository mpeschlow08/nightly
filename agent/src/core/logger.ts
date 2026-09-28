import type { AgentLogger, LogLevel } from "./types";

const SECRET_KEY = /secret|token|password|credential|authorization|cookie|api[_-]?key|private[_-]?key|ssid/i;
const SECRET_VALUE = /(?:bearer\s+|\b(?:token|password|secret|credential)\s*[=:]\s*)[^\s,;]+/gi;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof value === "string") return value.replace(SECRET_VALUE, "[REDACTED]").slice(0, 2000);
  if (Array.isArray(value)) return value.slice(0, 64).map((entry) => redact(entry, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 64).map(([key, entry]) => [key, SECRET_KEY.test(key) ? "[REDACTED]" : redact(entry, depth + 1)]));
  }
  return value;
}

export class JsonLineLogger implements AgentLogger {
  constructor(private readonly write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)) {}

  log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
    this.write(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...redact(fields) as object }));
  }
}