"use client";

import { useCallback, useState, useTransition } from "react";

import { useLivePolling } from "@/components/bookings/useLivePolling";

type TableSnapshot = {
  id: number;
  tableCode: string;
  name: string;
  sectionName: string | null;
  liveStatus: "available" | "reserved" | "occupied" | "cleaning" | "vip_hold" | "out_of_service";
  occupyingBooking: { bookingId: number; reservationName: string | null; partySize: number; status: string; startAt: string | null } | null;
  nextBooking: { bookingId: number; reservationName: string | null; partySize: number; status: string; startAt: string | null } | null;
};

const quickActions = [
  { action: "mark_available", label: "Available" },
  { action: "mark_cleaning", label: "Cleaning" },
  { action: "place_vip_hold", label: "VIP Hold" },
  { action: "remove_vip_hold", label: "Remove Hold" },
  { action: "out_of_service", label: "Out of Service" },
  { action: "release_table", label: "Release" },
] as const;

export default function OwnerTableStatusBoardClient() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch("/api/bookings/table-status", { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error("Failed to load table status");
    }

    const payload = (await response.json()) as { tables?: TableSnapshot[] };
    return payload.tables ?? [];
  }, []);

  const {
    data: rows,
    setData: setRows,
    loading,
    refreshing,
    error,
    lastUpdated,
  } = useLivePolling({ initialData: [], load, intervalMs: 15000, hiddenIntervalMs: 30000 });

  const applyAction = (tableId: number, action: string) => {
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/bookings/table-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueTableId: tableId, action }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setActionError(payload.error ?? "Unable to update table status");
          return;
        }

        setActionError(null);

        setRows((current) => current.map((row) => {
          if (row.id !== tableId) {
            return row;
          }
          if (action === "mark_available" || action === "remove_vip_hold" || action === "release_table") return { ...row, liveStatus: "available" };
          if (action === "mark_cleaning") return { ...row, liveStatus: "cleaning" };
          if (action === "place_vip_hold") return { ...row, liveStatus: "vip_hold" };
          if (action === "out_of_service") return { ...row, liveStatus: "out_of_service" };
          return row;
        }));
      })();
    });
  };

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Table Operations</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Live table status</h2>
      <p className="mt-2 min-h-5 text-xs text-zinc-400">
        {loading ? "Loading table status..." : refreshing ? "Updating..." : lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Live updates active"}
      </p>

      {error || actionError ? <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{actionError ?? error}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{row.tableCode}</p>
                <p className="mt-1 text-lg font-semibold text-white">{row.name}</p>
                <p className="text-sm text-zinc-400">{row.sectionName ?? "General"}</p>
              </div>
              <p className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">{row.liveStatus.replace(/_/g, " ")}</p>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
              <p>Current: {row.occupyingBooking ? `${row.occupyingBooking.reservationName ?? "Reservation"} (${row.occupyingBooking.partySize})` : "None"}</p>
              <p>Next: {row.nextBooking ? `${row.nextBooking.reservationName ?? "Reservation"} @ ${row.nextBooking.startAt ? new Date(row.nextBooking.startAt).toLocaleTimeString() : "TBD"}` : "None"}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickActions.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  disabled={isPending}
                  onClick={() => applyAction(row.id, item.action)}
                  className="rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs text-zinc-200 hover:border-cyan-300/30 disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
