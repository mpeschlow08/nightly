"use client";

import { useCallback, useState, useTransition } from "react";

import { useLivePolling } from "@/components/bookings/useLivePolling";

type WaitlistRow = {
  id: number;
  fullName: string;
  partySize: number;
  preferredSection: string | null;
  preferredTimeAt: string | null;
  status: string;
  expiresAt: string | null;
};

export default function OwnerWaitlistQueueClient() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadWaitlist = useCallback(async (signal: AbortSignal) => {
    const response = await fetch("/api/bookings/waitlist", { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error("Failed to load waitlist");
    }
    const payload = (await response.json()) as { waitlist?: WaitlistRow[] };
    return payload.waitlist ?? [];
  }, []);

  const {
    data: rows,
    setData: setRows,
    loading,
    refreshing,
    error,
    lastUpdated,
  } = useLivePolling({ initialData: [], load: loadWaitlist, intervalMs: 15000, hiddenIntervalMs: 30000 });

  const mutate = (id: number, nextStatus: string) => {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/bookings/waitlist", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entryId: id, nextStatus }),
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? "Unable to update waitlist entry");
          }

          setActionError(null);
          setRows((current) => current.map((row) => row.id === id ? { ...row, status: nextStatus } : row));
        } catch (mutationError) {
          setActionError(mutationError instanceof Error ? mutationError.message : "Unable to update waitlist entry");
        }
      })();
    });
  };

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Waitlist Queue</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Owner waitlist workflow</h2>
      <p className="mt-2 min-h-5 text-xs text-zinc-400">
        {loading ? "Loading waitlist..." : refreshing ? "Updating..." : lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Live updates active"}
      </p>

      {error || actionError ? <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{actionError ?? error}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-white">{row.fullName}</p>
                <p className="text-sm text-zinc-300">Party {row.partySize} • {row.preferredSection ?? "Any section"}</p>
              </div>
              <p className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-fuchsia-100">{row.status.replace(/_/g, " ")}</p>
            </div>
            <p className="mt-2 text-sm text-zinc-400">Preferred time: {row.preferredTimeAt ? new Date(row.preferredTimeAt).toLocaleString() : "Flexible"}</p>
            <p className="text-sm text-zinc-400">Offer expires: {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "Not offered"}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={isPending} onClick={() => mutate(row.id, "offered")} className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100">Offer</button>
              <button type="button" disabled={isPending} onClick={() => mutate(row.id, "accepted")} className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">Accept</button>
              <button type="button" disabled={isPending} onClick={() => mutate(row.id, "expired")} className="rounded-full border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-xs text-amber-100">Expire</button>
              <button type="button" disabled={isPending} onClick={() => mutate(row.id, "declined")} className="rounded-full border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">Decline</button>
            </div>
          </article>
        ))}
        {!loading && rows.length === 0 ? <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-400">No queue entries.</p> : null}
      </div>
    </section>
  );
}
