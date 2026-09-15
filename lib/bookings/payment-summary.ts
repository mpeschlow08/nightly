export type ReservationPaymentOption = "deposit_only" | "pay_in_full";

export type ReservationPaymentSummaryInput = {
  minimumSpendCents: number;
  bottleMinimumCents: number;
  reservationFeeCents: number;
  bottleSubtotalCents: number;
  addonSubtotalCents: number;
  depositPercent: number;
  paymentOption: ReservationPaymentOption;
};

export type ReservationPaymentSummary = {
  spendTargetCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  dueNowCents: number;
  remainingBalanceCents: number;
  minimumSpendRemainingCents: number;
};

export function buildReservationPaymentSummary(input: ReservationPaymentSummaryInput): ReservationPaymentSummary {
  const spendTargetCents = Math.max(input.minimumSpendCents, input.bottleMinimumCents, input.bottleSubtotalCents);
  const subtotalCents = spendTargetCents + input.addonSubtotalCents + input.reservationFeeCents;
  const serviceFeeCents = Math.round(subtotalCents * 0.08);
  const taxCents = Math.round(subtotalCents * 0.07);
  const totalCents = subtotalCents + serviceFeeCents + taxCents;
  const normalizedDepositPercent = Math.min(Math.max(input.depositPercent, 0), 100);
  const depositCents = Math.round(totalCents * (normalizedDepositPercent / 100));
  const dueNowCents = input.paymentOption === "pay_in_full" ? totalCents : depositCents;

  return {
    spendTargetCents,
    serviceFeeCents,
    taxCents,
    totalCents,
    depositCents,
    dueNowCents,
    remainingBalanceCents: Math.max(totalCents - dueNowCents, 0),
    minimumSpendRemainingCents: Math.max(input.minimumSpendCents - input.bottleSubtotalCents, 0),
  };
}