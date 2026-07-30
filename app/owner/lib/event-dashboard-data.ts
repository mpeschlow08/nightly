import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  djProfiles,
  eventAnalyticsDaily,
  eventLineup,
  eventModerationFlags,
  eventNotificationOutbox,
  eventRevisionRequests,
  events,
} from "@/db/schema";

import { getCurrentOwnerVenue } from "./ownership";

export type DashboardEventStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "live"
  | "completed"
  | "cancelled"
  | "archived";

export type EventDashboardItem = typeof events.$inferSelect;

export type EventLineupRow = typeof eventLineup.$inferSelect & {
  djName: string | null;
};

export type EventAnalyticsSummary = {
  eventId: number;
  views: number;
  favorites: number;
  shares: number;
  guestListRequests: number;
  reservationRequests: number;
  ticketClicks: number;
};

export type EventTrafficSourceRow = {
  eventId: number;
  trafficSource: string;
  views: number;
  favorites: number;
  shares: number;
  guestListRequests: number;
  reservationRequests: number;
  ticketClicks: number;
};

export type EventDailyTrendRow = {
  eventId: number;
  metricDate: Date;
  views: number;
  ticketClicks: number;
  guestListRequests: number;
  reservationRequests: number;
};

export type EventDashboardData = {
  venueId: number;
  venueName: string;
  events: EventDashboardItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  counts: Record<DashboardEventStatus, number>;
  lineupByEventId: Map<number, EventLineupRow[]>;
  analyticsByEventId: Map<number, EventAnalyticsSummary>;
  trafficSourceByEventId: Map<number, EventTrafficSourceRow[]>;
  trendsByEventId: Map<number, EventDailyTrendRow[]>;
  moderationSummaryByEventId: Map<number, { openFlags: number; openRevisions: number }>;
  pendingNotificationsByEventId: Map<number, number>;
  djDirectory: Array<{ id: number; stageName: string; username: string }>;
};

export type EventDashboardQuery = {
  q?: string;
  status?: DashboardEventStatus | "all";
  sort?: "newest" | "oldest" | "start_desc" | "start_asc" | "title_asc";
  page?: number;
  pageSize?: number;
};

function getSortExpression(sort: EventDashboardQuery["sort"]) {
  switch (sort) {
    case "oldest":
      return [asc(events.createdAt)] as const;
    case "start_asc":
      return [asc(events.startsAt)] as const;
    case "start_desc":
      return [desc(events.startsAt)] as const;
    case "title_asc":
      return [asc(events.title)] as const;
    case "newest":
    default:
      return [desc(events.createdAt)] as const;
  }
}

async function runLifecycleAutoTransitionForVenue(venueId: number) {
  const now = new Date();

  await db
    .update(events)
    .set({
      lifecycleStatus: "completed",
      completedAt: now,
      updatedAt: now,
      isPublished: false,
      publicationStatus: "draft",
    })
    .where(
      and(
        eq(events.venueId, venueId),
        lte(events.endsAt, now),
        or(eq(events.lifecycleStatus, "live"), eq(events.lifecycleStatus, "published"), eq(events.lifecycleStatus, "scheduled"))
      )
    );

  await db
    .update(events)
    .set({
      lifecycleStatus: "live",
      updatedAt: now,
      publicationStatus: "published",
      isPublished: true,
      publishedAt: now,
    })
    .where(
      and(
        eq(events.venueId, venueId),
        lte(events.startsAt, now),
        or(isNull(events.endsAt), gte(events.endsAt, now)),
        or(eq(events.lifecycleStatus, "published"), eq(events.lifecycleStatus, "scheduled"))
      )
    );

  await db
    .update(events)
    .set({
      lifecycleStatus: "published",
      updatedAt: now,
      publicationStatus: "published",
      isPublished: true,
    })
    .where(
      and(
        eq(events.venueId, venueId),
        gte(events.startsAt, now),
        eq(events.isPublished, true),
        eq(events.lifecycleStatus, "scheduled")
      )
    );
}

function groupByEventId<T extends { eventId: number }>(rows: T[]) {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const current = map.get(row.eventId) ?? [];
    current.push(row);
    map.set(row.eventId, current);
  }
  return map;
}

export async function getEventDashboardData(query: EventDashboardQuery): Promise<EventDashboardData> {
  const { venueId, venue } = await getCurrentOwnerVenue();
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 5), 100);
  const page = Math.max(query.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  await runLifecycleAutoTransitionForVenue(venueId);

  const clauses = [eq(events.venueId, venueId)];

  if (query.status && query.status !== "all") {
    clauses.push(eq(events.lifecycleStatus, query.status));
  }

  if (query.q && query.q.trim().length > 0) {
    const search = `%${query.q.trim()}%`;
    const searchPredicate = or(
      ilike(events.title, search),
      ilike(events.subtitle, search),
      ilike(events.description, search),
      ilike(events.genre, search)
    );

    if (searchPredicate) {
      clauses.push(searchPredicate);
    }
  }

  const eventRows = await db
    .select()
    .from(events)
    .where(and(...clauses))
    .orderBy(...getSortExpression(query.sort))
    .limit(pageSize)
    .offset(offset);

  const [totalCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(...clauses));

  const countsRows = await db
    .select({ status: events.lifecycleStatus, count: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.venueId, venueId))
    .groupBy(events.lifecycleStatus);

  const counts: Record<DashboardEventStatus, number> = {
    draft: 0,
    scheduled: 0,
    published: 0,
    live: 0,
    completed: 0,
    cancelled: 0,
    archived: 0,
  };

  for (const row of countsRows) {
    counts[row.status as DashboardEventStatus] = row.count;
  }

  const eventIds = eventRows.map((event) => event.id);

  const [lineupRows, analyticsRows, trafficRows, trendRows, moderationRows, revisionRows, notificationRows, djDirectory] =
    eventIds.length === 0
      ? [[], [], [], [], [], [], [], []]
      : await Promise.all([
          db
            .select({
              id: eventLineup.id,
              eventId: eventLineup.eventId,
              djProfileId: eventLineup.djProfileId,
              guestDjName: eventLineup.guestDjName,
              performanceStartsAt: eventLineup.performanceStartsAt,
              performanceEndsAt: eventLineup.performanceEndsAt,
              isFeaturedDj: eventLineup.isFeaturedDj,
              sortOrder: eventLineup.sortOrder,
              createdAt: eventLineup.createdAt,
              updatedAt: eventLineup.updatedAt,
              djName: djProfiles.stageName,
            })
            .from(eventLineup)
            .leftJoin(djProfiles, eq(eventLineup.djProfileId, djProfiles.id))
            .where(inArray(eventLineup.eventId, eventIds))
            .orderBy(asc(eventLineup.eventId), asc(eventLineup.sortOrder), asc(eventLineup.id)),
          db
            .select({
              eventId: eventAnalyticsDaily.eventId,
              views: sql<number>`coalesce(sum(${eventAnalyticsDaily.views}), 0)::int`,
              favorites: sql<number>`coalesce(sum(${eventAnalyticsDaily.favorites}), 0)::int`,
              shares: sql<number>`coalesce(sum(${eventAnalyticsDaily.shares}), 0)::int`,
              guestListRequests: sql<number>`coalesce(sum(${eventAnalyticsDaily.guestListRequests}), 0)::int`,
              reservationRequests: sql<number>`coalesce(sum(${eventAnalyticsDaily.reservationRequests}), 0)::int`,
              ticketClicks: sql<number>`coalesce(sum(${eventAnalyticsDaily.ticketClicks}), 0)::int`,
            })
            .from(eventAnalyticsDaily)
            .where(inArray(eventAnalyticsDaily.eventId, eventIds))
            .groupBy(eventAnalyticsDaily.eventId),
          db
            .select({
              eventId: eventAnalyticsDaily.eventId,
              trafficSource: eventAnalyticsDaily.trafficSource,
              views: sql<number>`coalesce(sum(${eventAnalyticsDaily.views}), 0)::int`,
              favorites: sql<number>`coalesce(sum(${eventAnalyticsDaily.favorites}), 0)::int`,
              shares: sql<number>`coalesce(sum(${eventAnalyticsDaily.shares}), 0)::int`,
              guestListRequests: sql<number>`coalesce(sum(${eventAnalyticsDaily.guestListRequests}), 0)::int`,
              reservationRequests: sql<number>`coalesce(sum(${eventAnalyticsDaily.reservationRequests}), 0)::int`,
              ticketClicks: sql<number>`coalesce(sum(${eventAnalyticsDaily.ticketClicks}), 0)::int`,
            })
            .from(eventAnalyticsDaily)
            .where(inArray(eventAnalyticsDaily.eventId, eventIds))
            .groupBy(eventAnalyticsDaily.eventId, eventAnalyticsDaily.trafficSource)
            .orderBy(asc(eventAnalyticsDaily.eventId), desc(sql`coalesce(sum(${eventAnalyticsDaily.views}), 0)`)),
          db
            .select({
              eventId: eventAnalyticsDaily.eventId,
              metricDate: eventAnalyticsDaily.metricDate,
              views: eventAnalyticsDaily.views,
              ticketClicks: eventAnalyticsDaily.ticketClicks,
              guestListRequests: eventAnalyticsDaily.guestListRequests,
              reservationRequests: eventAnalyticsDaily.reservationRequests,
            })
            .from(eventAnalyticsDaily)
            .where(inArray(eventAnalyticsDaily.eventId, eventIds))
            .orderBy(asc(eventAnalyticsDaily.eventId), desc(eventAnalyticsDaily.metricDate)),
          db
            .select({ eventId: eventModerationFlags.eventId, openFlags: sql<number>`count(*)::int` })
            .from(eventModerationFlags)
            .where(and(inArray(eventModerationFlags.eventId, eventIds), eq(eventModerationFlags.status, "open")))
            .groupBy(eventModerationFlags.eventId),
          db
            .select({ eventId: eventRevisionRequests.eventId, openRevisions: sql<number>`count(*)::int` })
            .from(eventRevisionRequests)
            .where(and(inArray(eventRevisionRequests.eventId, eventIds), eq(eventRevisionRequests.status, "open")))
            .groupBy(eventRevisionRequests.eventId),
          db
            .select({ eventId: eventNotificationOutbox.eventId, pendingNotifications: sql<number>`count(*)::int` })
            .from(eventNotificationOutbox)
            .where(and(inArray(eventNotificationOutbox.eventId, eventIds), eq(eventNotificationOutbox.status, "queued")))
            .groupBy(eventNotificationOutbox.eventId),
          db
            .select({ id: djProfiles.id, stageName: djProfiles.stageName, username: djProfiles.username })
            .from(djProfiles)
            .orderBy(asc(djProfiles.stageName))
            .limit(200),
        ]);

  const lineupByEventId = groupByEventId(lineupRows as EventLineupRow[]);

  const analyticsByEventId = new Map<number, EventAnalyticsSummary>();
  for (const row of analyticsRows as EventAnalyticsSummary[]) {
    analyticsByEventId.set(row.eventId, row);
  }

  const trafficSourceByEventId = groupByEventId(trafficRows as EventTrafficSourceRow[]);
  const trendsByEventId = groupByEventId(trendRows as EventDailyTrendRow[]);

  const moderationSummaryByEventId = new Map<number, { openFlags: number; openRevisions: number }>();
  for (const row of moderationRows as Array<{ eventId: number; openFlags: number }>) {
    moderationSummaryByEventId.set(row.eventId, { openFlags: row.openFlags, openRevisions: 0 });
  }
  for (const row of revisionRows as Array<{ eventId: number; openRevisions: number }>) {
    const current = moderationSummaryByEventId.get(row.eventId) ?? { openFlags: 0, openRevisions: 0 };
    moderationSummaryByEventId.set(row.eventId, { ...current, openRevisions: row.openRevisions });
  }

  const pendingNotificationsByEventId = new Map<number, number>();
  for (const row of notificationRows as Array<{ eventId: number; pendingNotifications: number }>) {
    pendingNotificationsByEventId.set(row.eventId, row.pendingNotifications);
  }

  return {
    venueId,
    venueName: venue.name,
    events: eventRows,
    totalCount: totalCountRow?.count ?? 0,
    page,
    pageSize,
    counts,
    lineupByEventId,
    analyticsByEventId,
    trafficSourceByEventId,
    trendsByEventId,
    moderationSummaryByEventId,
    pendingNotificationsByEventId,
    djDirectory,
  };
}
