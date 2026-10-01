export function classifyHealthCheckResult(input: {
  state: string;
  resultCode: string | null;
  expiresAt: Date;
  grantExpiresAt: Date;
  grantRevokedAt: Date | null;
}, incomingCode: "health_ok" | "health_degraded", now: Date): "complete" | "duplicate" | "conflict" | "expired" {
  if (input.grantRevokedAt || input.grantExpiresAt <= now || input.expiresAt <= now) return "expired";
  if (input.state === "succeeded") return input.resultCode === incomingCode ? "duplicate" : "conflict";
  return input.state === "pending" ? "complete" : "expired";
}