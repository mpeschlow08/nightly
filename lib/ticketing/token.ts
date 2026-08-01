import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;

function getTicketTokenSecret() {
  const secret = process.env.TICKET_TOKEN_SECRET;

  if (!secret) {
    throw new Error("TICKET_TOKEN_SECRET is required to issue and verify ticket QR tokens.");
  }

  return secret;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(content: string) {
  return createHmac("sha256", getTicketTokenSecret()).update(content).digest("base64url");
}

export function issueTicketToken(tokenId: string) {
  const payload = `${TOKEN_VERSION}.${tokenId}`;
  const signature = sign(payload);
  return base64UrlEncode(`${payload}.${signature}`);
}

export function verifyTicketToken(token: string) {
  const decoded = base64UrlDecode(token);
  const [versionText, tokenId, signature] = decoded.split(".");

  if (versionText !== String(TOKEN_VERSION) || !tokenId || !signature) {
    return null;
  }

  const expectedSignature = sign(`${versionText}.${tokenId}`);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  return { version: TOKEN_VERSION, tokenId };
}
