import Link from "next/link";

import OwnerArrivalBoardClient from "@/components/bookings/OwnerArrivalBoardClient";
import OwnerTableStatusBoardClient from "@/components/bookings/OwnerTableStatusBoardClient";
import OwnerWaitlistQueueClient from "@/components/bookings/OwnerWaitlistQueueClient";
import { requireOwnerBookingActor } from "@/app/bookings/lib/auth";

export default async function OwnerArrivalsPage() {
  await requireOwnerBookingActor();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(236,72,153,0.12),_transparent_28%),linear-gradient(138deg,_#06090f_0%,_#0a0f1d_55%,_#14122a_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <OwnerArrivalBoardClient />
        <OwnerTableStatusBoardClient />
        <OwnerWaitlistQueueClient />
        <div className="flex flex-wrap gap-3">
          <Link href="/owner/bookings" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">Bookings</Link>
          <Link href="/owner/vip" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">VIP Ops</Link>
        </div>
      </div>
    </main>
  );
}
