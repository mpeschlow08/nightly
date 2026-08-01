import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import ServerDashboardClient from "@/components/bookings/ServerDashboardClient";
import { db } from "@/db";
import { venueServers, venueStaffProfiles } from "@/db/schema";

export default async function ServerDashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const staff = await db.query.venueStaffProfiles.findFirst({
    where: and(eq(venueStaffProfiles.clerkUserId, userId), eq(venueStaffProfiles.status, "active")),
    columns: { id: true, venueId: true, department: true, firstName: true, lastName: true },
  });

  if (!staff || staff.department !== "vip") {
    redirect("/home");
  }

  const server = await db.query.venueServers.findFirst({
    where: and(eq(venueServers.staffProfileId, staff.id), eq(venueServers.isActive, true)),
    columns: { id: true, venueId: true },
  });

  if (!server) {
    redirect("/owner/vip");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_92%_8%,_rgba(236,72,153,0.14),_transparent_28%),linear-gradient(138deg,_#05070d_0%,_#090f19_56%,_#1a132d_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <ServerDashboardClient serverId={server.id} venueId={server.venueId} />
        <div className="flex flex-wrap gap-3">
          <Link href="/owner/vip" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">VIP Operations</Link>
          <Link href="/owner/arrivals" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">Arrival Board</Link>
        </div>
      </div>
    </main>
  );
}
