"use client";

import { FormEvent, useState, useTransition } from "react";

type Props = {
  bookingId: number;
  venueId: number | null;
  initialPartySize: number;
  isTerminal: boolean;
};

export default function CustomerReservationActionsClient({ bookingId, venueId, initialPartySize, isTerminal }: Props) {
  const [partySize, setPartySize] = useState(String(initialPartySize));
  const [upgradeTableId, setUpgradeTableId] = useState("");
  const [bottleIds, setBottleIds] = useState("");
  const [addonIds, setAddonIds] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [waitlistSection, setWaitlistSection] = useState("");
  const [waitlistTime, setWaitlistTime] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parseIds = (raw: string) => raw.split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0);

  const submitModification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/bookings/updates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            partySize: Number(partySize),
            upgradeTableId: upgradeTableId ? Number(upgradeTableId) : undefined,
            addBottleIds: parseIds(bottleIds),
            addAddonIds: parseIds(addonIds),
            changeRequest: specialRequest || "Customer requested reservation updates.",
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setStatusMessage(payload.error ?? "Unable to submit modification request.");
          return;
        }

        setStatusMessage("Modification submitted. Updated totals are calculated server-side.");
      })();
    });
  };

  const submitCancel = () => {
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/bookings/updates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            cancel: true,
            changeRequest: "Customer cancellation request",
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setStatusMessage(payload.error ?? "Unable to cancel reservation.");
          return;
        }

        setStatusMessage("Cancellation request processed according to venue policy.");
      })();
    });
  };

  const joinWaitlist = () => {
    if (!venueId) {
      setStatusMessage("Venue context missing for waitlist join.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/bookings/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            bookingId,
            fullName: "Booking Guest",
            partySize: Number(partySize),
            preferredSection: waitlistSection || undefined,
            preferredTimeAt: waitlistTime || undefined,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string; idempotent?: boolean };
        if (!response.ok) {
          setStatusMessage(payload.error ?? "Unable to join waitlist.");
          return;
        }

        setStatusMessage(payload.idempotent ? "Already on waitlist." : "Joined waitlist successfully.");
      })();
    });
  };

  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Customer actions</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Modify reservation</h2>

      {isTerminal ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">This reservation is finalized and cannot be modified.</p>
      ) : (
        <form onSubmit={submitModification} className="mt-4 grid gap-3">
          <label className="text-sm text-zinc-300">
            Party size
            <input value={partySize} onChange={(event) => setPartySize(event.target.value)} type="number" min={1} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-zinc-300">
            Upgrade table ID
            <input value={upgradeTableId} onChange={(event) => setUpgradeTableId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-zinc-300">
            Add bottle IDs (comma-separated)
            <input value={bottleIds} onChange={(event) => setBottleIds(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-zinc-300">
            Add add-on IDs (comma-separated)
            <input value={addonIds} onChange={(event) => setAddonIds(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-zinc-300">
            Special request or owner review note
            <textarea value={specialRequest} onChange={(event) => setSpecialRequest(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-100 disabled:opacity-50">Submit changes</button>
            <button type="button" disabled={isPending} onClick={submitCancel} className="rounded-full border border-rose-300/35 bg-rose-500/15 px-4 py-2 text-xs text-rose-100 disabled:opacity-50">Cancel reservation</button>
          </div>
        </form>
      )}

      <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
        <p className="text-sm font-medium text-white">Waitlist</p>
        <p className="mt-1 text-xs text-zinc-400">Join or hold your place if immediate modification cannot be fulfilled.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={waitlistSection} onChange={(event) => setWaitlistSection(event.target.value)} placeholder="Preferred section" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
          <input value={waitlistTime} onChange={(event) => setWaitlistTime(event.target.value)} type="datetime-local" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
        </div>
        <button type="button" disabled={isPending} onClick={joinWaitlist} className="mt-3 rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-4 py-2 text-xs text-fuchsia-100 disabled:opacity-50">Join waitlist</button>
      </div>

      {statusMessage ? <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200">{statusMessage}</p> : null}
    </section>
  );
}
