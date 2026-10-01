import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { presence, socialProfiles, venues } from "@/db/schema";
import { getSocialDashboardData } from "./data";

export async function getFriendRadarData() {
  const dashboard = await getSocialDashboardData();
  const friendIds = dashboard.friends.map((friend) => friend.userId);
  if (friendIds.length === 0) return { friends: [], sharingMode: dashboard.privacy?.locationVisibility ?? "friends" };

  const rows = await db
    .select({
      userId: presence.userId,
      status: presence.status,
      visibility: presence.visibility,
      venueId: presence.venueId,
      venueName: venues.name,
      approximateLocationLabel: presence.approximateLocationLabel,
      lastSeenAt: presence.lastSeenAt,
      displayName: socialProfiles.displayName,
      handle: socialProfiles.handle,
    })
    .from(presence)
    .innerJoin(socialProfiles, eq(socialProfiles.userId, presence.userId))
    .leftJoin(venues, eq(venues.id, presence.venueId))
    .where(and(inArray(presence.userId, friendIds), inArray(presence.visibility, ["public", "friends", "close_friends"])));

  const closeFriendIds = new Set(dashboard.friends.filter((friend) => friend.isCloseFriend).map((friend) => friend.userId));
  const now = Date.now();
  return {
    sharingMode: dashboard.privacy?.locationVisibility ?? "friends",
    friends: rows.map((row) => {
      const stale = now - row.lastSeenAt.getTime() > 15 * 60 * 1000;
      const allowed = row.visibility !== "close_friends" || closeFriendIds.has(row.userId);
      const precision = !allowed ? "not_sharing" : row.venueName ? "venue" : row.approximateLocationLabel ? "approximate" : "unavailable";
      return {
        userId: row.userId,
        displayName: row.displayName,
        handle: row.handle,
        status: stale ? "stale" : row.status,
        precision,
        venueName: allowed ? row.venueName : null,
        approximateLocationLabel: allowed && precision === "approximate" ? row.approximateLocationLabel : null,
        lastSeenAt: row.lastSeenAt.toISOString(),
      };
    }),
  };
}
