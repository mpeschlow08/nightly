import Link from "next/link";

import DoorReservationsClient from "@/components/bookings/DoorReservationsClient";
import { requireDoorStaffTicketActor } from "@/app/tickets/lib/auth";

export default async function DoorReservationsPage() {
  const actor = await requireDoorStaffTicketActor();
  const venueId = actor.venueId ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_92%_8%,_rgba(244,63,94,0.12),_transparent_28%),linear-gradient(138deg,_#05070d_0%,_#0a0f1b_56%,_#181727_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {venueId ? (
          <DoorReservationsClient venueId={venueId} />
        ) : (
          <section className="rounded-[1.7rem] border border-amber-400/30 bg-amber-500/10 p-6 text-amber-100">
            No venue assignment found for this door account.
          </section>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href="/door" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">Ticket Scans</Link>
          <Link href="/owner/arrivals" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">Arrival Board</Link>
        </div>
      </div>
    </main>
  );
}
