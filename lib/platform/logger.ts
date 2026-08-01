type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const SECRET_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apiKey",
  "api_key",
  "database_url",
  "stripe",
  "svix",
];

function isSecretKey(key: string) {
  const lower = key.toLowerCase();
  return SECRET_KEYS.some((candidate) => lower.includes(candidate.toLowerCase()));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      output[key] = isSecretKey(key) ? "[REDACTED]" : redact(item);
    }

    return output;
  }

  if (typeof value === "string" && value.includes("postgresql://")) {
    return "[REDACTED_DATABASE_URL]";
  }

  return value;
}

export const loggerInternals = {
  redact,
};

function write(level: LogLevel, message: string, fields?: LogFields) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    service: "nightly-web",
    ...(fields ? (redact(fields) as LogFields) : {}),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  if (level === "debug" && process.env.NODE_ENV === "production") {
    return;
  }

  console.log(line);
}

export const logger = {
  debug(message: string, fields?: LogFields) {
    write("debug", message, fields);
  },
  info(message: string, fields?: LogFields) {
    write("info", message, fields);
  },
  warn(message: string, fields?: LogFields) {
    write("warn", message, fields);
  },
  error(message: string, fields?: LogFields) {
    write("error", message, fields);
  },
};
