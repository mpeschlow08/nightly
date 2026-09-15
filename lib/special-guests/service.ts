export type SpecialGuestType =
  | "artist"
  | "celebrity"
  | "athlete"
  | "influencer"
  | "host"
  | "special_appearance"
  | "custom";

export type SpecialGuestVerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";

export type SpecialGuestStatus = "scheduled" | "active" | "cancelled" | "expired" | "archived";

export type SpecialGuestModerationFilter = {
  verificationStatus: SpecialGuestVerificationStatus | "all";
  status: SpecialGuestStatus | "all";
  eventId: number | null;
  venueId: number | null;
  query: string;
  fromDate: string;
  toDate: string;
};

export type SpecialGuestHistoryAction =
  | "created"
  | "updated"
  | "duplicated"
  | "cancelled"
  | "archived"
  | "verification_updated"
  | "auto_expired";

export type SpecialGuestRecord = {
  id: number;
  displayName: string;
  stageName: string | null;
  guestType: SpecialGuestType;
  customGuestType: string | null;
  shortDescription: string | null;
  appearanceStartAt: Date;
  appearanceEndAt: Date;
  visibilityStartAt: Date | null;
  visibilityEndAt: Date | null;
  verificationStatus: SpecialGuestVerificationStatus;
  status: SpecialGuestStatus;
  isActive: boolean;
  isArchived: boolean;
  cancelledAt: Date | null;
};

export type SpecialGuestHighlight = {
  primary: {
    id: number;
    title: string;
    subtitle: string;
    badge: string;
    typeLabel: string;
    verificationBadge: string | null;
  };
  additionalCount: number;
};

export type SpecialGuestAnalyticsCounters = {
  views: number;
  clicks: number;
  venueConversions: number;
  reservationConversions: number;
  ticketConversions: number;
  revenueCents: number;
  popularityScore: number;
};

export type SpecialGuestAnalyticsEvent =
  | "view"
  | "click"
  | "venue_conversion"
  | "reservation_conversion"
  | "ticket_conversion";

export type SpecialGuestLifecycleInput = {
  status: SpecialGuestStatus;
  isArchived: boolean;
  isActive: boolean;
  appearanceStartAt: Date;
  appearanceEndAt: Date;
  visibilityStartAt: Date | null;
  visibilityEndAt: Date | null;
  cancelledAt: Date | null;
};

export const SPECIAL_GUEST_FILTERS = [
  "has special guest",
  "artists",
  "celebrities",
  "influencers",
  "athletes",
  "hosts",
  "tonight",
  "this weekend",
] as const;

const guestPriorityByType: Record<SpecialGuestType, number> = {
  celebrity: 100,
  athlete: 90,
  artist: 80,
  influencer: 70,
  host: 60,
  special_appearance: 50,
  custom: 40,
};

function toCompactLower(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeSpecialGuestVerificationStatus(
  rawStatus: string | null | undefined,
  fallback: SpecialGuestVerificationStatus = "pending_review"
): SpecialGuestVerificationStatus {
  const normalized = toCompactLower(rawStatus);
  if (normalized === "unverified" || normalized === "pending_review" || normalized === "verified" || normalized === "rejected") {
    return normalized;
  }

  return fallback;
}

export function normalizeSpecialGuestStatus(
  rawStatus: string | null | undefined,
  fallback: SpecialGuestStatus = "scheduled"
): SpecialGuestStatus {
  const normalized = toCompactLower(rawStatus);
  if (normalized === "scheduled" || normalized === "active" || normalized === "cancelled" || normalized === "expired" || normalized === "archived") {
    return normalized;
  }

  return fallback;
}

function parseFilterNumeric(value: string | null | undefined): number | null {
  const normalized = toCompactLower(value);
  if (!normalized || normalized === "all") {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function normalizeDateInput(rawValue: string | null | undefined) {
  const trimmed = (rawValue ?? "").trim();
  if (!trimmed) {
    return "";
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

export function buildSpecialGuestModerationFilter(raw: Record<string, string | null | undefined>): SpecialGuestModerationFilter {
  const verificationRaw = toCompactLower(raw.verificationStatus);
  const statusRaw = toCompactLower(raw.status);

  return {
    verificationStatus:
      verificationRaw === "all" || !verificationRaw
        ? "all"
        : normalizeSpecialGuestVerificationStatus(verificationRaw, "pending_review"),
    status: statusRaw === "all" || !statusRaw ? "all" : normalizeSpecialGuestStatus(statusRaw, "scheduled"),
    eventId: parseFilterNumeric(raw.eventId),
    venueId: parseFilterNumeric(raw.venueId),
    query: (raw.q ?? "").trim(),
    fromDate: normalizeDateInput(raw.from),
    toDate: normalizeDateInput(raw.to),
  };
}

export function toSpecialGuestTypeLabel(type: SpecialGuestType, customType: string | null) {
  if (type === "custom") {
    return customType?.trim() || "Custom";
  }

  if (type === "special_appearance") {
    return "Special Appearance";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function deriveSpecialGuestStatus(input: SpecialGuestLifecycleInput, now: Date): SpecialGuestStatus {
  if (input.isArchived || input.status === "archived") {
    return "archived";
  }

  if (input.cancelledAt || input.status === "cancelled") {
    return "cancelled";
  }

  if (!input.isActive) {
    return "archived";
  }

  if (now > input.appearanceEndAt) {
    return "expired";
  }

  if (now >= input.appearanceStartAt) {
    return "active";
  }

  return "scheduled";
}

export function isSpecialGuestVisible(record: SpecialGuestRecord, now: Date) {
  const status = deriveSpecialGuestStatus(
    {
      status: record.status,
      isArchived: record.isArchived,
      isActive: record.isActive,
      appearanceStartAt: record.appearanceStartAt,
      appearanceEndAt: record.appearanceEndAt,
      visibilityStartAt: record.visibilityStartAt,
      visibilityEndAt: record.visibilityEndAt,
      cancelledAt: record.cancelledAt,
    },
    now
  );

  if (status === "archived" || status === "cancelled") {
    return false;
  }

  if (record.visibilityStartAt && now < record.visibilityStartAt) {
    return false;
  }

  if (record.visibilityEndAt && now > record.visibilityEndAt) {
    return false;
  }

  return true;
}

function specialGuestPriority(record: SpecialGuestRecord, now: Date) {
  const status = deriveSpecialGuestStatus(
    {
      status: record.status,
      isArchived: record.isArchived,
      isActive: record.isActive,
      appearanceStartAt: record.appearanceStartAt,
      appearanceEndAt: record.appearanceEndAt,
      visibilityStartAt: record.visibilityStartAt,
      visibilityEndAt: record.visibilityEndAt,
      cancelledAt: record.cancelledAt,
    },
    now
  );

  const verifiedBoost = record.verificationStatus === "verified" ? 25 : 0;
  const activeBoost = status === "active" ? 20 : status === "scheduled" ? 10 : 0;
  const timeBias = Math.max(0, 7_200_000 - Math.abs(record.appearanceStartAt.getTime() - now.getTime())) / 600_000;

  return guestPriorityByType[record.guestType] + verifiedBoost + activeBoost + timeBias;
}

export function toSpecialGuestHighlight(records: SpecialGuestRecord[], now: Date): SpecialGuestHighlight | null {
  const visible = records.filter((record) => isSpecialGuestVisible(record, now));

  if (visible.length === 0) {
    return null;
  }

  const sorted = [...visible].sort((left, right) => specialGuestPriority(right, now) - specialGuestPriority(left, now));
  const primary = sorted[0];
  const status = deriveSpecialGuestStatus(
    {
      status: primary.status,
      isArchived: primary.isArchived,
      isActive: primary.isActive,
      appearanceStartAt: primary.appearanceStartAt,
      appearanceEndAt: primary.appearanceEndAt,
      visibilityStartAt: primary.visibilityStartAt,
      visibilityEndAt: primary.visibilityEndAt,
      cancelledAt: primary.cancelledAt,
    },
    now
  );

  const title = status === "active" ? `Tonight: ${primary.stageName?.trim() || primary.displayName}` : "Special Guest: Future";

  const subtitle = primary.shortDescription?.trim() || toSpecialGuestTypeLabel(primary.guestType, primary.customGuestType);

  const badge = status === "active" ? "TONIGHT" : "UPCOMING";

  return {
    primary: {
      id: primary.id,
      title,
      subtitle,
      badge,
      typeLabel: toSpecialGuestTypeLabel(primary.guestType, primary.customGuestType),
      verificationBadge: primary.verificationStatus === "verified" ? "Verified" : null,
    },
    additionalCount: Math.max(0, visible.length - 1),
  };
}

export function matchesSpecialGuestSearch(
  query: string,
  guest: Pick<SpecialGuestRecord, "displayName" | "stageName" | "guestType" | "customGuestType">,
  context: { venueName?: string | null; eventName?: string | null }
) {
  const normalized = toCompactLower(query);
  if (!normalized) {
    return true;
  }

  const typeLabel = toSpecialGuestTypeLabel(guest.guestType, guest.customGuestType).toLowerCase();
  const haystack = [
    guest.displayName,
    guest.stageName,
    typeLabel,
    context.venueName,
    context.eventName,
    guest.guestType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function isTonight(appearanceStartAt: Date, now: Date) {
  return appearanceStartAt.toDateString() === now.toDateString();
}

function isThisWeekend(appearanceStartAt: Date) {
  const day = appearanceStartAt.getDay();
  return day === 5 || day === 6 || day === 0;
}

export function matchesSpecialGuestFilter(filter: string, guests: SpecialGuestRecord[], now: Date) {
  const normalized = toCompactLower(filter);
  if (!normalized) {
    return true;
  }

  if (normalized === "has special guest") {
    return guests.some((guest) => isSpecialGuestVisible(guest, now));
  }

  if (normalized === "tonight") {
    return guests.some((guest) => isSpecialGuestVisible(guest, now) && isTonight(guest.appearanceStartAt, now));
  }

  if (normalized === "this weekend") {
    return guests.some((guest) => isSpecialGuestVisible(guest, now) && isThisWeekend(guest.appearanceStartAt));
  }

  const lookup: Record<string, SpecialGuestType> = {
    artists: "artist",
    celebrities: "celebrity",
    influencers: "influencer",
    athletes: "athlete",
    hosts: "host",
  };

  const type = lookup[normalized];
  if (!type) {
    return true;
  }

  return guests.some((guest) => isSpecialGuestVisible(guest, now) && guest.guestType === type);
}

export function notificationTypesForSpecialGuestAction(action: SpecialGuestHistoryAction): string[] {
  if (action === "created" || action === "duplicated") {
    return ["special_guest_announced", "special_guest_reminder"];
  }

  if (action === "updated" || action === "verification_updated") {
    return ["special_guest_updated", "special_guest_starting_soon", "special_guest_reminder"];
  }

  if (action === "cancelled") {
    return ["special_guest_cancelled"];
  }

  if (action === "auto_expired") {
    return ["special_guest_expired"];
  }

  return [];
}

export function applySpecialGuestAnalyticsEvent(
  current: SpecialGuestAnalyticsCounters,
  event: SpecialGuestAnalyticsEvent,
  revenueCents = 0
): SpecialGuestAnalyticsCounters {
  const next = { ...current };

  if (event === "view") {
    next.views += 1;
  }

  if (event === "click") {
    next.clicks += 1;
  }

  if (event === "venue_conversion") {
    next.venueConversions += 1;
  }

  if (event === "reservation_conversion") {
    next.reservationConversions += 1;
    next.revenueCents += Math.max(0, revenueCents);
  }

  if (event === "ticket_conversion") {
    next.ticketConversions += 1;
    next.revenueCents += Math.max(0, revenueCents);
  }

  next.popularityScore =
    next.views +
    next.clicks * 3 +
    next.venueConversions * 5 +
    next.reservationConversions * 8 +
    next.ticketConversions * 8;

  return next;
}

export function parseSpecialGuestType(rawType: string | null | undefined): SpecialGuestType {
  const normalized = toCompactLower(rawType);
  if (
    normalized === "artist" ||
    normalized === "celebrity" ||
    normalized === "athlete" ||
    normalized === "influencer" ||
    normalized === "host" ||
    normalized === "special_appearance" ||
    normalized === "custom"
  ) {
    return normalized;
  }

  if (normalized === "special appearance") {
    return "special_appearance";
  }

  return "artist";
}
