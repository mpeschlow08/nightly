"use client";

import { FormEvent, useCallback, useState, useTransition } from "react";

import { useLivePolling } from "@/components/bookings/useLivePolling";

type DoorReservationRow = {
  bookingId: number;
  bookingNumber: string;
  reservationName: string | null;
  partySize: number;
  tableName: string | null;
  arrivalAt: string | null;
  lifecycleStatus: string;
  specialRequests: string | null;
};

type Props = {
  venueId: number;
};

export default function DoorReservationsClient({ venueId }: Props) {
  const [q, setQ] = useState("");
  const [scanToken, setScanToken] = useState("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/bookings/door-dashboard?venueId=${venueId}&q=${encodeURIComponent(q)}`, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error("Unable to load reservation board");
    }

    const payload = (await response.json()) as { reservations?: DoorReservationRow[] };
    return payload.reservations ?? [];
  }, [q, venueId]);

  const {
    data: rows,
    loading,
    refreshing,
    error,
    lastUpdated,
  } = useLivePolling({ initialData: [], load, intervalMs: 15000, hiddenIntervalMs: 30000 });

  const handleScan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/bookings/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkInToken: scanToken, venueId, method: "door_qr" }),
          });
          const payload = (await response.json()) as { decision?: string; reason?: string; error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Check-in failed");
          }
          setScanResult(`${payload.decision ?? "processed"}: ${payload.reason ?? "Scan logged"}`);
          setScanToken("");
        } catch (scanError) {
          setScanResult(scanError instanceof Error ? scanError.message : "Check-in failed");
        }
      })();
    });
  };

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Door Staff Reservations</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Arrivals and QR check-in</h2>
      <p className="mt-2 min-h-5 text-xs text-zinc-400">
        {loading ? "Loading reservations..." : refreshing ? "Updating..." : lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Live updates active"}
      </p>

      <form onSubmit={handleScan} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={scanToken}
          onChange={(event) => setScanToken(event.target.value)}
          placeholder="Scan or paste reservation token"
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
        />
        <button type="submit" disabled={isPending || !scanToken.trim()} className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-5 py-3 text-sm text-cyan-100 disabled:opacity-50">
          Check In
        </button>
      </form>

      {scanResult ? <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200">{scanResult}</p> : null}

      <div className="mt-4">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name, phone note, or booking ID"
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
        />
      </div>

      {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <article key={row.bookingId} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{row.bookingNumber}</p>
                <p className="mt-1 text-lg font-semibold text-white">{row.reservationName ?? "Reservation"}</p>
                <p className="mt-1 text-sm text-zinc-300">{row.tableName ?? "Unassigned table"} • Party {row.partySize}</p>
              </div>
              <p className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">{row.lifecycleStatus.replace(/_/g, " ")}</p>
            </div>
            <p className="mt-2 text-sm text-zinc-300">Arrival: {row.arrivalAt ? new Date(row.arrivalAt).toLocaleString() : "Not set"}</p>
            <p className="mt-1 text-sm text-zinc-400">Special requests: {row.specialRequests ?? "None"}</p>
          </article>
        ))}
        {!loading && rows.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm text-zinc-400">No reservations found.</p>
        ) : null}
      </div>
    </section>
  );
}
