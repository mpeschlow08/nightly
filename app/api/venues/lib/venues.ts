import { db } from "@/db";
import { venueBusinessHours, venueImages, venues } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export type VenueBusinessHourRow = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function isValidTime(value: string | null): value is string {
  if (!value) {
    return false;
  }

  return /^\d{2}:\d{2}$/.test(value);
}

export function formatHourLabel(time: string | null) {
  if (!isValidTime(time)) {
    return "--";
  }

  const [rawHour, rawMinute] = time.split(":");
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "--";
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const clockHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${clockHour}:${rawMinute} ${suffix}`;
}

export function toDayTimeMinutes(time: string | null) {
  if (!isValidTime(time)) {
    return null;
  }

  const [rawHour, rawMinute] = time.split(":");
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

export function normalizeBusinessHours(rows: VenueBusinessHourRow[]) {
  const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));

  return dayLabels.map((_, dayOfWeek) => {
    const row = byDay.get(dayOfWeek);

    return {
      dayOfWeek,
      openTime: row?.openTime ?? null,
      closeTime: row?.closeTime ?? null,
      isClosed: row?.isClosed ?? true,
    };
  });
}

export function getVenueHoursStatus(hours: VenueBusinessHourRow[], now = new Date()) {
  const normalized = normalizeBusinessHours(hours);
  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayHours = normalized[today];
  const openMinutes = toDayTimeMinutes(todayHours.openTime);
  const closeMinutes = toDayTimeMinutes(todayHours.closeTime);

  const hasTodayWindow = !todayHours.isClosed && openMinutes != null && closeMinutes != null;

  if (hasTodayWindow && currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return {
      todayHoursLabel: `${formatHourLabel(todayHours.openTime)} - ${formatHourLabel(todayHours.closeTime)}`,
      statusLabel: "Open Now",
      isOpenNow: true,
    };
  }

  if (hasTodayWindow && currentMinutes < openMinutes) {
    return {
      todayHoursLabel: `${formatHourLabel(todayHours.openTime)} - ${formatHourLabel(todayHours.closeTime)}`,
      statusLabel: `Closed • Opens at ${formatHourLabel(todayHours.openTime)}`,
      isOpenNow: false,
    };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const dayIndex = (today + offset) % 7;
    const row = normalized[dayIndex];

    if (!row.isClosed && isValidTime(row.openTime)) {
      return {
        todayHoursLabel: todayHours.isClosed
          ? "Closed today"
          : `${formatHourLabel(todayHours.openTime)} - ${formatHourLabel(todayHours.closeTime)}`,
        statusLabel: `Closed • Opens at ${formatHourLabel(row.openTime)}`,
        isOpenNow: false,
      };
    }
  }

  return {
    todayHoursLabel: todayHours.isClosed
      ? "Closed today"
      : `${formatHourLabel(todayHours.openTime)} - ${formatHourLabel(todayHours.closeTime)}`,
    statusLabel: "Closed",
    isOpenNow: false,
  };
}

export async function getVenues() {
  return db.select().from(venues);
}

export async function getVenueById(id: number) {
  const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);

  return venue;
}

export async function getVenueImages(venueId: number) {
  return db
    .select()
    .from(venueImages)
    .where(eq(venueImages.venueId, venueId))
    .orderBy(asc(venueImages.sortOrder));
}

export async function getVenueBusinessHours(venueId: number) {
  return db
    .select({
      dayOfWeek: venueBusinessHours.dayOfWeek,
      openTime: venueBusinessHours.openTime,
      closeTime: venueBusinessHours.closeTime,
      isClosed: venueBusinessHours.isClosed,
    })
    .from(venueBusinessHours)
    .where(eq(venueBusinessHours.venueId, venueId))
    .orderBy(asc(venueBusinessHours.dayOfWeek));
}