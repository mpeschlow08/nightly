import { createPublicKey, verify } from "node:crypto";
import { createHash } from "node:crypto";

export type SignedUpdateManifest = {
  version: string;
  sha256: string;
  downloadUrl: string;
  notBefore: string;
  expiresAt: string;
  signature: string;
};

export type UpdateDecision = { eligible: boolean; reason: string; manifestDigest: string | null };

export function verifyUpdateManifest(manifest: SignedUpdateManifest, publicKeyPem: string, now = new Date()): UpdateDecision {
  try {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) return { eligible: false, reason: "invalid_version", manifestDigest: null };
    if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) return { eligible: false, reason: "invalid_digest", manifestDigest: null };
    const url = new URL(manifest.downloadUrl);
    if (url.protocol !== "https:") return { eligible: false, reason: "https_required", manifestDigest: null };
    const notBefore = Date.parse(manifest.notBefore);
    const expiresAt = Date.parse(manifest.expiresAt);
    if (!Number.isFinite(notBefore) || !Number.isFinite(expiresAt) || notBefore > now.getTime() || expiresAt <= now.getTime() || expiresAt <= notBefore) {
      return { eligible: false, reason: "outside_validity_window", manifestDigest: null };
    }
    const signedPayload = JSON.stringify({ version: manifest.version, sha256: manifest.sha256.toLowerCase(), downloadUrl: url.toString(), notBefore: new Date(notBefore).toISOString(), expiresAt: new Date(expiresAt).toISOString() });
    const valid = verify(null, Buffer.from(signedPayload), createPublicKey(publicKeyPem), Buffer.from(manifest.signature, "base64"));
    if (!valid) return { eligible: false, reason: "signature_invalid", manifestDigest: null };
    return { eligible: true, reason: "signature_verified_no_install_performed", manifestDigest: createHash("sha256").update(signedPayload).digest("hex") };
  } catch {
    return { eligible: false, reason: "manifest_invalid", manifestDigest: null };
  }
}