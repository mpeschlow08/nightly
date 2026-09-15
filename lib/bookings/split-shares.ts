export type SplitShareAmount = {
  amountCents: number;
};

export function sumSplitShareAmounts(shares: SplitShareAmount[]) {
  return shares.reduce((sum, share) => sum + Math.max(Math.trunc(share.amountCents), 0), 0);
}

export function assertSplitShareTotalMatches(shares: SplitShareAmount[], totalCents: number) {
  if (shares.length === 0) {
    return;
  }

  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    throw new Error("Split bill amounts must match the booking total exactly.");
  }

  const splitTotal = sumSplitShareAmounts(shares);

  if (splitTotal !== totalCents) {
    throw new Error("Split bill amounts must match the booking total exactly.");
  }
}