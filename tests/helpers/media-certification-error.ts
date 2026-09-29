import { extractPostgresErrorMetadata } from "../../lib/nightly-device/database-errors";

export function classifyMediaCertificationError(error: unknown) {
  const metadata = extractPostgresErrorMetadata(error);
  const code = metadata?.code && /^[0-9A-Z]{5}$/.test(metadata.code) ? metadata.code : null;
  const constraint = metadata?.constraint && /^[a-z][a-z0-9_]{0,127}$/.test(metadata.constraint) ? metadata.constraint : null;
  const category = code === "22P02" ? "invalid_enum" :
    code === "23502" ? "not_null_violation" :
    code === "23503" ? "foreign_key_violation" :
    code === "23505" ? "unique_violation" :
    code === "23514" ? "check_violation" : "unknown_database_error";
  return { code, constraint, category };
}