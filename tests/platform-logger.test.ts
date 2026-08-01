import assert from "node:assert/strict";
import test from "node:test";

import { loggerInternals } from "../lib/platform/logger";

test("logger redacts secret-like fields and database URLs", () => {
  const payload = {
    authorization: "Bearer abc",
    nested: {
      apiKey: "secret",
      message: "ok",
    },
    connection: "postgresql://user:pass@host:5432/db",
  };

  const redacted = loggerInternals.redact(payload) as {
    authorization: string;
    nested: { apiKey: string; message: string };
    connection: string;
  };

  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.nested.apiKey, "[REDACTED]");
  assert.equal(redacted.nested.message, "ok");
  assert.equal(redacted.connection, "[REDACTED_DATABASE_URL]");
});
