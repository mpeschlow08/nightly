const NIGHTLIFE_CUTOFF_HOUR = 6;

function utcPartsForZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: string) => Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function zonedStartOfDayUtc(date: Date, timeZone: string) {
  const parts = utcPartsForZone(date, timeZone);

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
}

export function getNightWindow(now: Date, timeZone: string) {
  const local = utcPartsForZone(now, timeZone);
  const dayStartUtc = zonedStartOfDayUtc(now, timeZone);

  const windowStart =
    local.hour < NIGHTLIFE_CUTOFF_HOUR
      ? new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000)
      : new Date(dayStartUtc.getTime() + 18 * 60 * 60 * 1000);

  const windowEnd = new Date(windowStart.getTime() + 12 * 60 * 60 * 1000);

  return { windowStart, windowEnd };
}

export function isInTonightWindow(startsAt: Date, endsAt: Date | null, now: Date, timeZone: string) {
  const { windowStart, windowEnd } = getNightWindow(now, timeZone);
  const effectiveEnd = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  return startsAt < windowEnd && effectiveEnd > windowStart;
}

export function isEventLive(startsAt: Date, endsAt: Date | null, now: Date) {
  const effectiveEnd = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  return now >= startsAt && now <= effectiveEnd;
}

export function formatTimeLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateLabel(date: Date, now: Date, timeZone: string) {
  const current = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(now);
  const target = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(date);

  if (current === target) {
    return "Tonight";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
