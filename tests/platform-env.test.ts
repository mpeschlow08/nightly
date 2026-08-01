import assert from "node:assert/strict";
import test from "node:test";

import { validateEnvironment } from "../lib/platform/env";

test("production environment reports missing required variables", () => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  };

  delete process.env.DATABASE_URL;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  process.env.APP_ENV = "production";

  const result = validateEnvironment("production");

  assert.equal(result.ok, false);
  assert.ok(result.missingRequired.includes("DATABASE_URL"));
  assert.ok(result.missingRequired.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"));
  assert.ok(result.missingRequired.includes("CLERK_SECRET_KEY"));

  process.env.APP_ENV = previous.APP_ENV;
  process.env.DATABASE_URL = previous.DATABASE_URL;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previous.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.CLERK_SECRET_KEY = previous.CLERK_SECRET_KEY;
});
