import assert from "node:assert/strict";
import test from "node:test";

import { assertSplitShareTotalMatches, sumSplitShareAmounts } from "@/lib/bookings/split-shares";

test("split share totals sum cleanly", () => {
  assert.equal(sumSplitShareAmounts([{ amountCents: 1200 }, { amountCents: 800 }]), 2000);
});

test("split share validation accepts an exact match", () => {
  assert.doesNotThrow(() => {
    assertSplitShareTotalMatches([{ amountCents: 1200 }, { amountCents: 800 }], 2000);
  });
});

test("split share validation rejects underpayment or overpayment", () => {
  assert.throws(() => {
    assertSplitShareTotalMatches([{ amountCents: 1200 }, { amountCents: 700 }], 2000);
  }, /must match the booking total exactly/i);
});