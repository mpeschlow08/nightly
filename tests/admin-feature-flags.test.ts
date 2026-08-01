import assert from "node:assert/strict";
import test from "node:test";

import { evaluateFlagState } from "@/app/admin/lib/feature-flags";

test("kill switch always disables", () => {
  const result = evaluateFlagState({
    key: "concierge",
    enabled: true,
    killSwitch: true,
    rolloutPercentage: 100,
    overrides: [],
    context: {},
  });

  assert.equal(result.enabled, false);
  assert.equal(result.source, "killswitch");
});

test("user override wins over global", () => {
  const result = evaluateFlagState({
    key: "venue_intelligence",
    enabled: false,
    killSwitch: false,
    rolloutPercentage: 100,
    overrides: [{ scope: "user", scopeValue: "user_123", enabled: true }],
    context: { userId: "user_123" },
  });

  assert.equal(result.enabled, true);
  assert.equal(result.source, "override");
});

test("venue override can disable feature", () => {
  const result = evaluateFlagState({
    key: "ticketing",
    enabled: true,
    killSwitch: false,
    rolloutPercentage: 100,
    overrides: [{ scope: "venue", scopeValue: "42", enabled: false }],
    context: { venueId: "42" },
  });

  assert.equal(result.enabled, false);
  assert.equal(result.source, "override");
});

test("percentage rollout uses deterministic seed", () => {
  const inRollout = evaluateFlagState({
    key: "new_explore",
    enabled: true,
    killSwitch: false,
    rolloutPercentage: 25,
    overrides: [],
    context: { percentageSeed: 11 },
  });

  const outRollout = evaluateFlagState({
    key: "new_explore",
    enabled: true,
    killSwitch: false,
    rolloutPercentage: 25,
    overrides: [],
    context: { percentageSeed: 57 },
  });

  assert.equal(inRollout.enabled, true);
  assert.equal(outRollout.enabled, false);
});
