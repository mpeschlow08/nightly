import assert from "node:assert/strict";
import test from "node:test";

import { validateEnvironment } from "@/lib/platform/env";

test("cloudflare env variables are declared as server scope", () => {
  const report = validateEnvironment("development");
  const variables = report.groups.flatMap((group) => group.variables);

  const account = variables.find((v) => v.key === "CLOUDFLARE_STREAM_ACCOUNT_ID");
  const token = variables.find((v) => v.key === "CLOUDFLARE_STREAM_API_TOKEN");
  const ttl = variables.find((v) => v.key === "LIVE_PLAYBACK_AUTH_TTL_SECONDS");
  const provider = variables.find((v) => v.key === "CAMERA_LIVE_PROVIDER");

  assert.equal(account?.scope, "server");
  assert.equal(token?.scope, "server");
  assert.equal(ttl?.scope, "server");
  assert.equal(provider?.scope, "server");
});

test("mux credentials are declared as server-scoped secrets", () => {
  const report = validateEnvironment("development");
  const variables = report.groups.flatMap((group) => group.variables);

  for (const key of ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "MUX_SIGNING_KEY_ID", "MUX_SIGNING_KEY_PRIVATE_KEY"]) {
    const variable = variables.find((v) => v.key === key);
    assert.equal(variable?.scope, "server", `${key} must be server scoped`);
    assert.equal(variable?.secret, true, `${key} must be marked secret`);
  }
});
