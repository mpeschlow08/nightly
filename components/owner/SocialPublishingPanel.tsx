"use client";

import { useRef, useState } from "react";

import type { SocialPublishingMode } from "@/lib/social-publishing/types";

type Account = {
  id: string;
  platform: string;
  displayName: string;
  connectionState: string;
  authorizationState: string;
  reconnectRequired: boolean;
};

type HotReelOption = { id: string; capturedAt: string | null; durationMs: number | null };
type Destination = { id: string; platform: string; accountName: string; state: string; publicUrl: string | null; failureCode: string | null };
type Distribution = { id: string; state: string; policyModeSnapshot: SocialPublishingMode; requestedAt: string; destinations: Destination[] };

type Props = {
  venueId: number;
  accounts: Account[];
  hotReels: HotReelOption[];
  policy: { mode: SocialPublishingMode; revision: number };
  distributions: Distribution[];
};

const modes: Array<{ value: SocialPublishingMode; label: string }> = [
  { value: "review_before_post", label: "Review before posting" },
  { value: "auto_publish", label: "Auto-publish" },
  { value: "disabled", label: "Disabled" },
];

const visibleState: Record<string, string> = {
  pending_review: "Pending review",
  queued: "Queued",
  processing: "In progress",
  completed: "Published",
  partial: "Partially published",
  failed: "Needs attention",
  cancelled: "Cancelled",
  published: "Published",
  failed_retryable: "Needs attention",
  failed_permanent: "Could not publish",
  waiting_for_review: "Pending review",
  revoked: "Unpublished",
  authorized: "In progress",
  uploading: "In progress",
  revoke_requested: "Unpublishing",
};

function platformLabel(value: string) {
  return value === "x" ? "X" : value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SocialPublishingPanel(props: Props) {
  const [accounts, setAccounts] = useState(props.accounts);
  const [policy, setPolicy] = useState(props.policy);
  const [distributions, setDistributions] = useState(props.distributions);
  const [selectedReel, setSelectedReel] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const idempotencyKey = useRef<string | null>(null);

  async function send(url: string, method: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error("That action is not available right now.");
    return result as Record<string, unknown>;
  }

  async function updatePolicy(mode: SocialPublishingMode) {
    setBusy(true);
    setMessage("");
    try {
      const result = await send("/api/owner/social-publishing/policy", "PUT", { venueId: props.venueId, mode });
      setPolicy({ mode: result.mode as SocialPublishingMode, revision: Number(result.revision) });
      if (mode === "disabled") {
        setDistributions((current) => current.map((item) => item.state === "queued" || item.state === "pending_review"
          ? { ...item, state: "cancelled", destinations: item.destinations.map((destination) => destination.state === "queued" || destination.state === "waiting_for_review" ? { ...destination, state: "cancelled" } : destination) }
          : item));
      }
      setMessage("Publishing mode updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update publishing mode.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectAccount(accountId: string) {
    setBusy(true);
    setMessage("");
    try {
      await send("/api/owner/social-publishing/accounts", "DELETE", { venueId: props.venueId, accountId });
      setAccounts((current) => current.map((account) => account.id === accountId ? { ...account, connectionState: "disconnected", reconnectRequired: true } : account));
      setSelectedAccounts((current) => current.filter((id) => id !== accountId));
      setMessage("Account disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect account.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAccount(accountId: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await send(`/api/owner/social-publishing/accounts/${accountId}/refresh`, "POST", { venueId: props.venueId });
      setAccounts((current) => current.map((account) => account.id === accountId ? {
        ...account,
        connectionState: result.authorizationState === "valid" ? "connected" : "verification_failed",
        authorizationState: String(result.authorizationState),
        reconnectRequired: result.authorizationState !== "valid",
      } : account));
      setMessage(result.authorizationState === "valid" ? "Account authorization refreshed." : "Reconnect this account to continue publishing.");
    } catch {
      setMessage("Account authorization could not be refreshed.");
    } finally {
      setBusy(false);
    }
  }

  async function distribute() {
    if (!selectedReel || selectedAccounts.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await send("/api/owner/social-publishing/distributions", "POST", {
        venueId: props.venueId,
        hotReelId: selectedReel,
        accountIds: selectedAccounts,
        caption,
        idempotencyKey: idempotencyKey.current ?? (idempotencyKey.current = crypto.randomUUID().replaceAll("-", "")),
      });
      const distribution = (result.distribution ?? null) as Distribution | null;
      if (distribution) setDistributions((current) => [distribution, ...current]);
      idempotencyKey.current = null;
      setCaption("");
      setMessage("Distribution request created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create distribution.");
    } finally {
      setBusy(false);
    }
  }

  async function review(requestId: string, decision: "approve" | "reject") {
    setBusy(true);
    setMessage("");
    try {
      const result = await send(`/api/owner/social-publishing/distributions/${requestId}`, "POST", { venueId: props.venueId, decision });
      const distribution = (result.distribution ?? null) as Distribution | null;
      if (distribution) setDistributions((current) => current.map((item) => item.id === requestId ? distribution : item));
      setMessage(decision === "approve" ? "Approved for publishing." : "Distribution rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update review.");
    } finally {
      setBusy(false);
    }
  }

  async function destinationAction(destinationId: string, action: "retry" | "revoke") {
    setBusy(true);
    setMessage("");
    try {
      await send(`/api/owner/social-publishing/destinations/${destinationId}`, "POST", { venueId: props.venueId, action });
      setDistributions((current) => current.map((item) => ({
        ...item,
        destinations: item.destinations.map((destination) => destination.id === destinationId
          ? { ...destination, state: action === "retry" ? "queued" : "revoked" }
          : destination),
      })));
      setMessage(action === "retry" ? "Destination queued to retry." : "Unpublish request sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update destination.");
    } finally {
      setBusy(false);
    }
  }

  const connectedAccounts = accounts.filter((account) => account.connectionState === "connected" && account.authorizationState === "valid" && !account.reconnectRequired);
  const allDestinations = distributions.flatMap((distribution) => distribution.destinations);
  const summary = [
    { label: "Connected accounts", value: connectedAccounts.length },
    { label: "Pending review", value: distributions.filter((distribution) => distribution.state === "pending_review").length },
    { label: "Published", value: allDestinations.filter((destination) => destination.state === "published").length },
    { label: "Needs attention", value: allDestinations.filter((destination) => destination.state === "failed_retryable" || destination.state === "failed_permanent").length },
  ];

  return (
    <section className="mt-8 border-t border-white/10 pt-8" aria-labelledby="social-publishing-title">
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/75">External distribution</p>
      <h3 id="social-publishing-title" className="mt-2 text-xl font-semibold text-white">Social publishing</h3>
      <p className="mt-1 text-sm text-zinc-400">One request creates a separate publishing status for each destination.</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 sm:grid-cols-4">
        {summary.map((item) => <div key={item.label}><dt className="text-xs text-zinc-400">{item.label}</dt><dd className="mt-1 text-lg font-semibold text-white">{item.value}</dd></div>)}
      </dl>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <label htmlFor="social-publishing-mode" className="block text-sm font-medium text-white">Publishing mode</label>
            <select id="social-publishing-mode" value={policy.mode} disabled={busy} onChange={(event) => void updatePolicy(event.currentTarget.value as SocialPublishingMode)} className="mt-2 w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white">
              {modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-medium text-white">Connected accounts</h4>
              <span className="text-xs text-zinc-400">{connectedAccounts.length} active</span>
            </div>
            {accounts.length === 0 ? <p className="mt-3 text-sm text-zinc-400">No external accounts connected.</p> : (
              <ul className="mt-3 divide-y divide-white/10">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{account.displayName}</p>
                      <p className="text-xs text-zinc-400">{platformLabel(account.platform)} · {account.connectionState === "connected" && !account.reconnectRequired ? "Connected" : "Reconnect needed"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {account.reconnectRequired && account.authorizationState !== "revoked" ? <button type="button" disabled={busy} onClick={() => void refreshAccount(account.id)} className="rounded-md border border-amber-200/20 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-40">Refresh</button> : null}
                      <button type="button" disabled={busy || account.connectionState === "disconnected"} onClick={() => void disconnectAccount(account.id)} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-40">Disconnect</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-zinc-500">Official account connections are not configured yet.</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <h4 className="text-sm font-medium text-white">Distribute a Hot Reel</h4>
          {policy.mode === "disabled" ? <p className="mt-3 text-sm text-zinc-400">External publishing is disabled for this venue.</p> : (
            <>
              <label htmlFor="social-hot-reel" className="mt-3 block text-xs text-zinc-300">Approved Hot Reel</label>
              <select id="social-hot-reel" value={selectedReel} onChange={(event) => { idempotencyKey.current = null; setSelectedReel(event.currentTarget.value); }} className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white">
                <option value="">Choose a Hot Reel</option>
                {props.hotReels.map((reel) => <option key={reel.id} value={reel.id}>{reel.capturedAt ? new Date(reel.capturedAt).toLocaleString() : "Recent Hot Reel"}{reel.durationMs ? ` · ${Math.round(reel.durationMs / 1000)} sec` : ""}</option>)}
              </select>
              <label htmlFor="social-caption" className="mt-3 block text-xs text-zinc-300">Caption</label>
              <textarea id="social-caption" value={caption} maxLength={2200} onChange={(event) => { idempotencyKey.current = null; setCaption(event.currentTarget.value); }} rows={3} className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white" />
              <fieldset className="mt-3">
                <legend className="text-xs text-zinc-300">Destinations</legend>
                <div className="mt-2 space-y-2">
                  {connectedAccounts.map((account) => (
                    <label key={account.id} className="flex items-center gap-2 text-sm text-zinc-200">
                      <input type="checkbox" checked={selectedAccounts.includes(account.id)} onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        idempotencyKey.current = null;
                        setSelectedAccounts((current) => checked ? [...current, account.id] : current.filter((id) => id !== account.id));
                      }} />
                      {account.displayName} <span className="text-xs text-zinc-500">{platformLabel(account.platform)}</span>
                    </label>
                  ))}
                  {connectedAccounts.length === 0 ? <p className="text-sm text-zinc-400">Connect an account before choosing destinations.</p> : null}
                </div>
              </fieldset>
              <button type="button" disabled={busy || !selectedReel || selectedAccounts.length === 0} onClick={() => void distribute()} className="mt-4 rounded-md border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">{policy.mode === "review_before_post" ? "Send for review" : "Publish to selected accounts"}</button>
            </>
          )}
        </div>
      </div>

      {message ? <p role="status" className="mt-4 text-sm text-cyan-100">{message}</p> : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-white">Publication history</h4>
          <button type="button" disabled={busy} onClick={() => window.location.reload()} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-40">Refresh status</button>
        </div>
        {distributions.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No external publishing activity yet.</p> : (
          <ul className="mt-3 divide-y divide-white/10">
            {distributions.map((distribution) => (
              <li key={distribution.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">{visibleState[distribution.state] ?? "Status unavailable"}</p>
                  <p className="text-xs text-zinc-500">{new Date(distribution.requestedAt).toLocaleString()}</p>
                </div>
                {distribution.state === "pending_review" ? <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => void review(distribution.id, "approve")} className="rounded-md border border-emerald-300/25 px-3 py-1.5 text-xs text-emerald-100">Approve</button><button type="button" disabled={busy} onClick={() => void review(distribution.id, "reject")} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-200">Reject</button></div> : null}
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {distribution.destinations.map((destination) => (
                    <li key={destination.id} className="rounded-lg border border-white/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-zinc-200">{destination.accountName} · {platformLabel(destination.platform)}</span>
                        <span className="shrink-0 text-xs text-zinc-400">{visibleState[destination.state] ?? "Status unavailable"}</span>
                      </div>
                      <div className="mt-2 flex gap-3 text-xs">
                        {destination.publicUrl ? <a href={destination.publicUrl} target="_blank" rel="noreferrer" className="text-cyan-200 underline">View post</a> : null}
                        {destination.state === "failed_retryable" ? <button type="button" disabled={busy} onClick={() => void destinationAction(destination.id, "retry")} className="text-amber-200 underline">Retry</button> : null}
                        {destination.state === "published" || destination.state === "revoke_requested" ? <button type="button" disabled={busy} onClick={() => void destinationAction(destination.id, "revoke")} className="text-zinc-300 underline">{destination.state === "revoke_requested" ? "Retry unpublish" : "Unpublish"}</button> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
