import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import { bookingDisputes, bookings, djProfiles, djSampleMixes, socialReports } from "@/db/schema";

type Props = {
  params: Promise<{ djId: string }>;
};

export default async function AdminDjDetailPage({ params }: Props) {
  await requireAdminPermission("djs:view");
  const { djId } = await params;
  const id = Number.parseInt(djId, 10);

  if (!Number.isFinite(id)) {
    notFound();
  }

  const [profile, mixes, bookingRows, disputes, reports] = await Promise.all([
    db.query.djProfiles.findFirst({ where: eq(djProfiles.id, id) }),
    db.select().from(djSampleMixes).where(eq(djSampleMixes.djProfileId, id)).orderBy(desc(djSampleMixes.createdAt)).limit(20),
    db.select().from(bookings).where(eq(bookings.djProfileId, id)).orderBy(desc(bookings.createdAt)).limit(30),
    db.select().from(bookingDisputes).orderBy(desc(bookingDisputes.createdAt)).limit(30),
    db.select().from(socialReports).orderBy(desc(socialReports.createdAt)).limit(30),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">{profile.stageName}</h1>
      <p className="text-sm text-zinc-300">DJ #{profile.id} • {profile.username}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Sample mixes</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(mixes, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Bookings</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(bookingRows, null, 2)}</pre>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Booking disputes</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(disputes, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Reports</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(reports, null, 2)}</pre>
        </article>
      </div>
    </main>
  );
}
