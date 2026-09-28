export type PostgresErrorMetadata = {
  code: string | null;
  constraint: string | null;
  errorName: string | null;
  depth: number;
};

const MAX_ERROR_DEPTH = 8;

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

export function extractPostgresErrorMetadata(error: unknown): PostgresErrorMetadata | null {
  const visited = new Set<object>();
  let current: unknown = error;
  for (let depth = 0; depth < MAX_ERROR_DEPTH; depth += 1) {
    if (!current || (typeof current !== "object" && typeof current !== "function")) return null;
    const node = current as { code?: unknown; constraint?: unknown; name?: unknown; cause?: unknown };
    if (visited.has(node)) return null;
    visited.add(node);

    const code = safeString(node.code, 32);
    const constraint = safeString(node.constraint, 128);
    if (code || constraint) {
      return {
        code,
        constraint,
        errorName: safeString(node.name, 80),
        depth,
      };
    }
    current = node.cause;
  }
  return null;
}

export function isPostgresUniqueConstraintViolation(error: unknown, constraint: string) {
  const metadata = extractPostgresErrorMetadata(error);
  return metadata?.code === "23505" && metadata.constraint === constraint;
}

export function classifyNightlyDeviceInventoryWriteError(error: unknown) {
  if (!isPostgresUniqueConstraintViolation(error, "nightly_device_sources_venue_camera_unique")) return null;
  return {
    status: 409 as const,
    code: "source_camera_conflict",
    message: "Venue camera is already assigned to a source.",
  };
}