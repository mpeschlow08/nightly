import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;

function getSecret() {
  const secret = process.env.SOCIAL_TOKEN_SECRET;

  if (!secret) {
    throw new Error("SOCIAL_TOKEN_SECRET is required to generate social QR tokens.");
  }

  return secret;
}

function sign(content: string) {
  return createHmac("sha256", getSecret()).update(content).digest("base64url");
}

export function generateFriendCode() {
  return `NIGHT-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function issueFriendQrToken(friendCode: string) {
  const payload = `${TOKEN_VERSION}.${friendCode}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyFriendQrToken(token: string) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [versionText, friendCode, signature] = decoded.split(".");

    if (versionText !== String(TOKEN_VERSION) || !friendCode || !signature) {
      return null;
    }

    const expected = Buffer.from(sign(`${versionText}.${friendCode}`));
    const actual = Buffer.from(signature);

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    return { version: TOKEN_VERSION, friendCode };
  } catch {
    return null;
  }
}
