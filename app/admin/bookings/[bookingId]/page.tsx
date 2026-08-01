import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { db } from "@/db";
import {
  bookingAuditLog,
  bookingActivity,
  bookingAddons,
  bookingBottles,
  bookingDisputes,
  bookingItems,
  bookingPayments,
  bookingRefunds,
  bookingStatusHistory,
  billSplits,
  bookings,
  checkInLog,
  reservationNotifications,
  reservationStatusLog,
  serverAssignments,
  tableBookings,
  tableStatusLog,
  waitlistEntries,
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

  const [booking, history, payments, refunds, disputes, audit, tableBooking, bookingItemsRows, bottles, addons, splits, activity, reservationStatusRows, checkIns, notificationRows, assignmentRows, waitlistRows] = await Promise.all([
    db.query.bookings.findFirst({ where: eq(bookings.id, id) }),
    db.select().from(bookingStatusHistory).where(eq(bookingStatusHistory.bookingId, id)).orderBy(desc(bookingStatusHistory.createdAt)).limit(40),
    db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, id)).orderBy(desc(bookingPayments.createdAt)).limit(40),
    db.select().from(bookingRefunds).where(eq(bookingRefunds.bookingId, id)).orderBy(desc(bookingRefunds.createdAt)).limit(40),
    db.select().from(bookingDisputes).where(eq(bookingDisputes.bookingId, id)).orderBy(desc(bookingDisputes.createdAt)).limit(40),
    db.select().from(bookingAuditLog).where(eq(bookingAuditLog.bookingId, id)).orderBy(desc(bookingAuditLog.createdAt)).limit(40),
    db.select().from(tableBookings).where(eq(tableBookings.bookingId, id)).limit(1),
    db.select().from(bookingItems).where(eq(bookingItems.bookingId, id)).limit(80),
    db.select().from(bookingBottles).where(eq(bookingBottles.bookingId, id)).limit(80),
    db.select().from(bookingAddons).where(eq(bookingAddons.bookingId, id)).limit(80),
    db.select().from(billSplits).where(eq(billSplits.bookingId, id)).limit(80),
    db.select().from(bookingActivity).where(eq(bookingActivity.bookingId, id)).orderBy(desc(bookingActivity.createdAt)).limit(80),
    db.select().from(reservationStatusLog).where(eq(reservationStatusLog.bookingId, id)).orderBy(desc(reservationStatusLog.createdAt)).limit(80),
    db.select().from(checkInLog).where(eq(checkInLog.bookingId, id)).orderBy(desc(checkInLog.createdAt)).limit(80),
    db.select().from(reservationNotifications).where(eq(reservationNotifications.bookingId, id)).orderBy(desc(reservationNotifications.createdAt)).limit(80),
    db.select().from(serverAssignments).where(eq(serverAssignments.bookingId, id)).orderBy(desc(serverAssignments.createdAt)).limit(80),
    db.select().from(waitlistEntries).where(eq(waitlistEntries.bookingId, id)).orderBy(desc(waitlistEntries.createdAt)).limit(80),
  ]);

  const tableStatusRows = tableBooking[0]?.venueTableId
    ? await db
        .select()
        .from(tableStatusLog)
        .where(eq(tableStatusLog.venueTableId, tableBooking[0].venueTableId))
        .orderBy(desc(tableStatusLog.createdAt))
        .limit(80)
    : [];

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
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Table booking & split billing</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify({ tableBooking: tableBooking[0] ?? null, splits }, null, 2)}</pre>
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
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Booking catalog</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify({ bookingItems: bookingItemsRows, bottles, addons, activity }, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h2 className="text-sm font-semibold text-white">Reservation operations</h2>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify({ reservationStatusRows, checkIns, notificationRows, assignmentRows, waitlistRows, tableStatusRows }, null, 2)}</pre>
        </article>
      </div>
    </main>
  );
}
