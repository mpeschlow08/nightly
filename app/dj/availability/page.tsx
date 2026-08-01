import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

import { requireDjBookingActor } from "@/app/bookings/lib/auth";
import { db } from "@/db";
import { djAvailability, users } from "@/db/schema";
import { getDjProfileForUser } from "@/app/dj/lib/data";

export default async function DjAvailabilityPage() {
  await requireDjBookingActor();
  const { userId } = await auth();
  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.clerkUserId, userId),
        columns: { id: true },
      })
    : null;
  const profile = user ? await getDjProfileForUser(user.id) : null;
  const rows = profile
    ? await db.select().from(djAvailability).where(eq(djAvailability.djProfileId, profile.id)).orderBy(desc(djAvailability.createdAt), asc(djAvailability.availabilityDate))
    : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Availability</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Manage your booking windows</h1>
        <p className="mt-3 text-base text-zinc-300">The booking engine reads these windows when matching inquiries to your profile.</p>

        <div className="mt-6 space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">No availability windows yet.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm text-zinc-300">
                <p className="font-medium text-white">{row.availabilityDate ?? "Date not set"}</p>
                <p className="mt-1 text-zinc-400">{row.startTime ?? "Any time"} - {row.endTime ?? "Open ended"} • {row.timezone}</p>
                <p className="mt-1 text-zinc-400">{row.vacationMode ? "Vacation mode enabled" : "Accepting requests"}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dj/bookings" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
            Back to bookings
          </Link>
          <Link href="/dj/dashboard" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
