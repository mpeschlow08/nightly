import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { canAccessBooking, getReservationApiActor } from "@/app/api/bookings/_lib/access";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getOrCreateReservationPass } from "@/lib/bookings/operations";

export async function GET(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const actor = await getReservationApiActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await context.params;
  const id = Number(bookingId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const [booking] = await db
    .select({ id: bookings.id, venueId: bookings.venueId, consumerClerkUserId: bookings.consumerClerkUserId })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking?.venueId) {
    return NextResponse.json({ error: "Booking does not have a venue." }, { status: 404 });
  }

  if (!(await canAccessBooking(actor, booking.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pass = await getOrCreateReservationPass(booking.id, booking.venueId);
  const verificationUrl = new URL("/api/bookings/check-in", request.url).toString();

  return NextResponse.json({
    bookingId: booking.id,
    checkInToken: pass.checkInToken,
    verificationUrl,
    qrPayload: JSON.stringify({ type: "nightly_reservation", token: pass.checkInToken, bookingId: booking.id }),
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(JSON.stringify({ type: "nightly_reservation", token: pass.checkInToken, bookingId: booking.id }))}`,
    walletHooks: {
      appleWallet: "future",
      googleWallet: "future",
    },
  });
}
