import type { ForecastRange } from "./types";

export function combineForecasts(primary: ForecastRange, secondary: ForecastRange | null): ForecastRange {
  if (!secondary) {
    return primary;
  }

  const expected = Math.round(primary.expected * 0.75 + secondary.expected * 0.25);
  const low = Math.round(primary.low * 0.75 + secondary.low * 0.25);
  const high = Math.round(primary.high * 0.75 + secondary.high * 0.25);

  return {
    ...primary,
    expected,
    low,
    high,
    keySignals: [...primary.keySignals, ...secondary.keySignals].slice(0, 8),
    limitations: [...new Set([...primary.limitations, ...secondary.limitations])],
  };
}
