import { createHash, timingSafeEqual } from "node:crypto";

export function authorizedFleetSweep(authorization: string | null, configuredToken: string | undefined): boolean {
  const supplied = authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
  if (!supplied || !configuredToken || !/^[A-Za-z0-9_-]{32,128}$/.test(configuredToken)) return false;
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(configuredToken).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}