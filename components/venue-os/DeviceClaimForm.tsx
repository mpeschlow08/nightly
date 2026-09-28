"use client";

import { useState } from "react";

export default function DeviceClaimForm({ venueId }: { venueId: number }) {
  const [publicDeviceUuid, setPublicDeviceUuid] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function generateClaimCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function issueClaimCode() {
    if (!publicDeviceUuid.trim()) {
      setMessage("Enter the device ID first.");
      return;
    }

    setPending(true);
    setMessage("");
    try {
      const nextCode = generateClaimCode();
      const response = await fetch("/api/device/v1/claim-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicDeviceUuid: publicDeviceUuid.trim(),
          claimCode: nextCode,
          venueId,
        }),
      });
      if (!response.ok) {
        setMessage("A claim code could not be issued. Check the device ID or contact Nightly support.");
        return;
      }
      const result = (await response.json()) as { expiresAt?: string };
      setClaimCode(nextCode);
      setExpiresAt(result.expiresAt ?? "");
      setMessage("One-time claim code created. It is shown only in this page.");
    } catch {
      setMessage("A claim code could not be issued. Try again when your connection is restored.");
    } finally {
      setPending(false);
    }
  }

  async function submitClaim() {
    if (!claimCode) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/device/v1/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicDeviceUuid: publicDeviceUuid.trim(), claimCode, venueId }),
      });
      if (response.ok) {
        setClaimCode("");
        setMessage("Nightly Box claimed. Refreshing device status...");
        window.location.reload();
      } else {
        setMessage("Claim could not be completed. The code may be expired or already used.");
      }
    } catch {
      setMessage("Claim could not be completed. Try again when your connection is restored.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs text-zinc-400">
          Device ID
          <input
            required
            autoComplete="off"
            value={publicDeviceUuid}
            onChange={(event) => setPublicDeviceUuid(event.target.value)}
            placeholder="Enter device ID"
            className="min-w-0 rounded-lg border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60"
          />
        </label>
        <button type="button" disabled={pending} onClick={issueClaimCode} className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-4 py-2.5 text-sm font-medium text-cyan-100 disabled:opacity-50">
          {pending ? "Working..." : "Generate one-time code"}
        </button>
      </div>
      {claimCode ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-400">One-time claim code</p>
            <output className="mt-1 block break-all font-mono text-sm text-white">{claimCode}</output>
            <p className="mt-1 text-xs text-zinc-500">Expires {expiresAt ? new Date(expiresAt).toLocaleString() : "soon"}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void navigator.clipboard.writeText(claimCode)} className="rounded-md border border-white/15 px-3 py-2 text-xs text-zinc-200">Copy</button>
            <button type="button" disabled={pending} onClick={submitClaim} className="rounded-md border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-xs font-medium text-cyan-100 disabled:opacity-50">{pending ? "Claiming..." : "Claim device"}</button>
          </div>
        </div>
      ) : null}
      {message ? <p role="status" className="text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}