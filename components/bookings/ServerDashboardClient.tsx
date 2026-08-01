"use client";

import { useCallback, useMemo, useTransition } from "react";

import { useLivePolling } from "@/components/bookings/useLivePolling";

type ServerReservationRow = {
  assignmentId: number;
  bookingId: number;
  bookingNumber: string;
  customerName: string | null;
  tableName: string | null;
  partySize: number;
  arrivalAt: string | null;
  lifecycleStatus: string;
  notes: string | null;
  assignmentStatus: string;
  bottles: Array<{ bookingId: number; label: string; quantity: number }>;
};

type Props = {
  serverId: number;
  venueId: number;
};

async function updateReservationStatus(bookingId: number, status: string, note: string) {
  const response = await fetch("/api/bookings/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, status, note }),
  });

  if (!response.ok) {
    throw new Error("Failed to update reservation status.");
  }
}

export default function ServerDashboardClient({ serverId, venueId }: Props) {
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/bookings/server-dashboard?serverId=${serverId}&venueId=${venueId}`, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error("Unable to load server dashboard");
    }

    const payload = (await response.json()) as { reservations?: ServerReservationRow[] };
    return payload.reservations ?? [];
  }, [serverId, venueId]);

  const {
    data: rows,
    setData: setRows,
    error,
    loading,
    refreshing,
    lastUpdated,
  } = useLivePolling({ initialData: [], load, intervalMs: 15000, hiddenIntervalMs: 30000 });

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => {
      const aTime = a.arrivalAt ? new Date(a.arrivalAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.arrivalAt ? new Date(b.arrivalAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }),
    [rows]
  );

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Bottle Server Dashboard</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Tonight&apos;s assignments</h2>
          <p className="mt-2 min-h-5 text-xs text-zinc-400">
            {loading ? "Loading reservations..." : refreshing ? "Updating..." : lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Live updates active"}
          </p>
        </div>
        <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-zinc-300">{sortedRows.length} assignments</p>
      </div>

      {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {sortedRows.map((row) => {
          return (
            <article key={row.assignmentId} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.bookingNumber}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{row.customerName ?? "Guest"}</p>
                  <p className="mt-1 text-sm text-zinc-300">{row.tableName ?? "No table"} • Party {row.partySize}</p>
                </div>
                <p className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-fuchsia-100">{row.lifecycleStatus.replace(/_/g, " ")}</p>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                <p>Arrival: {row.arrivalAt ? new Date(row.arrivalAt).toLocaleString() : "Not set"}</p>
                <p>Service status: {row.assignmentStatus.replace(/_/g, " ")}</p>
              </div>

              <p className="mt-2 text-sm text-zinc-300">Bottles: {row.bottles.length > 0 ? row.bottles.map((item) => `${item.label} x${item.quantity}`).join(", ") : "None"}</p>
              <p className="mt-1 text-sm text-zinc-400">Special requests: {row.notes ?? "None"}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => void updateReservationStatus(row.bookingId, "seated", "Server marked party seated.").then(() => {
                    setRows((current) => current.map((item) => item.assignmentId === row.assignmentId ? { ...item, lifecycleStatus: "seated" } : item));
                  }))}
                  className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-100"
                >
                  Mark Seated
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => void updateReservationStatus(row.bookingId, "bottle_service_active", "Bottle delivery started.").then(() => {
                    setRows((current) => current.map((item) => item.assignmentId === row.assignmentId ? { ...item, lifecycleStatus: "bottle_service_active" } : item));
                  }))}
                  className="rounded-full border border-violet-300/35 bg-violet-500/15 px-4 py-2 text-xs text-violet-100"
                >
                  Bottle Delivered
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => void updateReservationStatus(row.bookingId, "completed", "Service completed.").then(() => {
                    setRows((current) => current.map((item) => item.assignmentId === row.assignmentId ? { ...item, lifecycleStatus: "completed" } : item));
                  }))}
                  className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-xs text-emerald-100"
                >
                  Completed
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => void fetch("/api/bookings/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingId: row.bookingId, notificationType: "manager_assistance_requested", payload: { source: "server_dashboard" } }),
                  }))}
                  className="rounded-full border border-amber-300/35 bg-amber-500/15 px-4 py-2 text-xs text-amber-100"
                >
                  Request Assistance
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
