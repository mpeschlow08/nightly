import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import {
  bookingAuditLog,
  bookingDisputes,
  bookingPayments,
  bookingRefunds,
  bookingStatusHistory,
  bookings,
} from "@/db/schema";

type Props = {
  params: Promise<{ bookingId: string }>;
};

export default async function AdminBookingDetailPage({ params }: Props) {
  await requireAdminPermission("bookings:view");
  const { bookingId } = await params;
  const id = Number.parseInt(bookingId, 10);

  if (!Number.isFinite(id)) {
    notFound();
  }

  const [booking, history, payments, refunds, disputes, audit] = await Promise.all([
    db.query.bookings.findFirst({ where: eq(bookings.id, id) }),
    db.select().from(bookingStatusHistory).where(eq(bookingStatusHistory.bookingId, id)).orderBy(desc(bookingStatusHistory.createdAt)).limit(40),
    db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, id)).orderBy(desc(bookingPayments.createdAt)).limit(40),
    db.select().from(bookingRefunds).where(eq(bookingRefunds.bookingId, id)).orderBy(desc(bookingRefunds.createdAt)).limit(40),
    db.select().from(bookingDisputes).where(eq(bookingDisputes.bookingId, id)).orderBy(desc(bookingDisputes.createdAt)).limit(40),
    db.select().from(bookingAuditLog).where(eq(bookingAuditLog.bookingId, id)).orderBy(desc(bookingAuditLog.createdAt)).limit(40),
  ]);

  if (!booking) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Booking #{booking.id}</h1>
      <p className="text-sm text-zinc-300">{booking.bookingNumber} • {booking.lifecycleStatus}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Status timeline</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(history, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Payments and refunds</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify({ payments, refunds }, null, 2)}</pre>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Disputes</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(disputes, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Audit trail</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(audit, null, 2)}</pre>
        </article>
      </div>
    </main>
  );
}
