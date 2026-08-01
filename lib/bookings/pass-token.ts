import { createHmac, timingSafeEqual } from "node:crypto";

export type ReservationPassClaims = {
  bid: number;
  vid: number;
  iat: number;
  exp: number;
  ver: 1;
};

function getReservationPassSecret() {
  const configured = process.env.RESERVATION_PASS_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return "nightly-dev-reservation-pass-secret";
  }

  throw new Error("RESERVATION_PASS_SECRET is required in production.");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signReservationPassPayload(payloadB64: string) {
  return createHmac("sha256", getReservationPassSecret()).update(payloadB64).digest("hex");
}

export function createReservationPassToken(claims: ReservationPassClaims) {
  const payloadB64 = toBase64Url(JSON.stringify(claims));
  const signature = signReservationPassPayload(payloadB64);
  return `nrp.v1.${payloadB64}.${signature}`;
}

export function parseReservationPassToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "nrp" || parts[1] !== "v1") {
    return null;
  }

  const payloadB64 = parts[2];
  const signature = parts[3];
  const expected = signReservationPassPayload(payloadB64);

  if (signature.length !== expected.length) {
    return null;
  }

  const validSig = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSig) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64)) as ReservationPassClaims;
    if (parsed.ver !== 1 || !Number.isFinite(parsed.bid) || !Number.isFinite(parsed.vid) || !Number.isFinite(parsed.exp)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
