"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { useLivePolling } from "@/components/bookings/useLivePolling";

type ArrivalRow = {
  bookingId: number;
  bookingNumber: string;
  lifecycleStatus: string;
  requestedStartAt: string | null;
  guestCount: number;
  reservationName: string | null;
  partySize: number;
  tableName: string | null;
  serverName: string | null;
  serverId: number | null;
  depositRequiredCents: number;
  depositStatus: string;
  notes: string | null;
  specialRequests: string | null;
  bottles: Array<{ bookingId: number; label: string; quantity: number }>;
  splitStatuses: Array<{ bookingId: number; status: string }>;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function OwnerArrivalBoardClient() {
  const [referenceNow, setReferenceNow] = useState<number>(0);
  const [filter, setFilter] = useState<"all" | "arriving_soon" | "checked_in" | "waiting" | "seated" | "completed" | "payment_issue">("all");

  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch("/api/bookings/arrival-board", { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error("Failed to load arrivals");
    }

    const payload = (await response.json()) as { arrivals?: ArrivalRow[] };
    setReferenceNow(Date.now());
    return payload.arrivals ?? [];
  }, []);

  const {
    data: rows,
    setData: setRows,
    loading,
    refreshing,
    error,
    lastUpdated,
  } = useLivePolling({ initialData: [], load, intervalMs: 15000, hiddenIntervalMs: 30000 });

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => {
      const aTime = a.requestedStartAt ? new Date(a.requestedStartAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.requestedStartAt ? new Date(b.requestedStartAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") return sortedRows;

    return sortedRows.filter((row) => {
      if (filter === "arriving_soon") {
        if (!row.requestedStartAt) return false;
        const eta = new Date(row.requestedStartAt).getTime() - referenceNow;
        return eta >= 0 && eta <= 60 * 60 * 1000;
      }
      if (filter === "checked_in") return row.lifecycleStatus === "checked_in";
      if (filter === "waiting") return ["pending", "deposit_required", "deposit_paid", "confirmed"].includes(row.lifecycleStatus);
      if (filter === "seated") return ["seated", "bottle_service_active"].includes(row.lifecycleStatus);
      if (filter === "completed") return row.lifecycleStatus === "completed";
      if (filter === "payment_issue") return ["refund_pending", "refunded", "disputed"].includes(row.lifecycleStatus);
      return true;
    });
  }, [filter, sortedRows, referenceNow]);

  const runAction = async (bookingId: number, action: "arrived" | "seated" | "manager") => {
    if (action === "manager") {
      await fetch("/api/bookings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, notificationType: "manager_assistance_requested", payload: { source: "owner_arrival_board" } }),
      });
      return;
    }

    const status = action === "arrived" ? "checked_in" : "seated";
    await fetch("/api/bookings/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, status, note: `Owner marked ${status}.` }),
    });

    setRows((current) => current.map((row) => row.bookingId === bookingId ? { ...row, lifecycleStatus: status } : row));
  };

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Owner Arrival Board</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Live reservations</h2>
          <p className="mt-2 min-h-5 text-xs text-zinc-400">
            {loading ? "Loading arrivals..." : refreshing ? "Updating..." : lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Live updates active"}
          </p>
        </div>
        <p className="max-w-full rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-zinc-300">{sortedRows.length} reservations</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["all", "arriving_soon", "checked_in", "waiting", "seated", "completed", "payment_issue"].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option as typeof filter)}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${filter === option ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-black/20 text-zinc-300"}`}
          >
            {option.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {filteredRows.map((row) => (
          <article key={row.bookingId} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{row.bookingNumber}</p>
                <p className="mt-1 text-lg font-semibold text-white">{row.reservationName ?? "Reservation"}</p>
                <p className="mt-1 text-sm text-zinc-300">{row.tableName ?? "Unassigned table"} • Party {row.partySize || row.guestCount}</p>
              </div>
              <p className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">{row.lifecycleStatus.replace(/_/g, " ")}</p>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
              <p>Arrival: {row.requestedStartAt ? new Date(row.requestedStartAt).toLocaleString() : "Not set"}</p>
              <p>Server: {row.serverName ?? "Not assigned"}</p>
              <p>Deposit: {row.depositStatus} ({formatMoney(row.depositRequiredCents)})</p>
            </div>
            <p className="mt-2 text-sm text-zinc-300">Bottles: {row.bottles.length > 0 ? row.bottles.map((item) => `${item.label} x${item.quantity}`).join(", ") : "None"}</p>
            <p className="mt-1 text-sm text-zinc-400">Special requests: {row.specialRequests ?? row.notes ?? "None"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void runAction(row.bookingId, "arrived")} className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100">Mark Arrived</button>
              <button type="button" onClick={() => void runAction(row.bookingId, "seated")} className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">Mark Seated</button>
              <button type="button" onClick={() => void runAction(row.bookingId, "manager")} className="rounded-full border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-xs text-amber-100">Flag Manager</button>
              <Link href={`/bookings/${row.bookingId}`} className="rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs text-zinc-200">View Booking</Link>
            </div>
          </article>
        ))}
        {!loading && filteredRows.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-400">No upcoming reservations.</p>
        ) : null}
      </div>
    </section>
  );
}
