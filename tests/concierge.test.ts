import assert from "node:assert/strict";
import test from "node:test";

import { buildConciergeRecommendations, conciergeStarterPrompts } from "@/lib/concierge/service";
import type { ConciergeConversationContext } from "@/lib/concierge/types";

function context(): ConciergeConversationContext {
  const venue = {
    id: 1,
    slug: "atlas",
    href: "/venues/atlas",
    name: "Atlas",
    neighborhood: "Midtown",
    genre: "Hip-Hop",
    genres: ["Hip-Hop"],
    distanceLabel: "1.2 mi",
    isLive: true,
    liveLabel: "EVENT LIVE" as const,
    liveStatusProvenance: "live_system" as const,
    crowdLevel: "Buzzing",
    heroImageUrl: "/hero.jpg",
    thumbnailImageUrl: "/thumb.jpg",
    logoImageUrl: null,
    galleryImageUrls: ["/hero.jpg"],
    imageSource: "existing",
  };

  const event = {
    id: 11,
    slug: "atlas-friday",
    href: "/events/atlas-friday",
    name: "Atlas Friday",
    venueId: 1,
    venueName: "Atlas",
    venueSlug: "atlas",
    neighborhood: "Midtown",
    startTimeLabel: "10:00 PM",
    endTimeLabel: "1:00 AM",
    dateLabel: "Tonight",
    genres: ["Hip-Hop"],
    cover: 20,
    ageRequirementLabel: "21+",
    dressCode: "Upscale",
    crowdLevel: "Buzzing",
    ticketStatus: "On sale",
    ticketUrl: "https://tickets.local",
    guestListUrl: null,
    isLive: false,
    imageUrl: "/event.jpg",
    distanceMiles: 1.5,
  };

  return {
    homeData: {
      heroSummary: {
        greeting: "Good evening, Atlanta",
        title: "Atlanta is buzzing tonight.",
        subtitle: "Midtown is active and Buckhead is warming up.",
      },
      cityPulse: {
        headline: "Atlanta is buzzing tonight.",
        summary: "Midtown is active and Buckhead is warming up.",
        facts: [],
        generatedAtIso: new Date().toISOString(),
        freshness: "live",
        actionTargets: [],
      },
      tonightTopPicks: [venue],
      eventsStartingSoon: [event],
      vibeForYou: [venue],
      trendingNeighborhoods: [],
      friendsInterestedVenues: [venue],
      friendsInterestedEvents: [event],
      liveTonight: [venue],
      trending: [venue],
      eventsTonight: [event],
      popularNearby: [venue],
      recommended: [venue],
    },
    exploreData: {
      venues: [venue],
      events: [event],
      djs: [],
      neighborhoods: [],
      categories: [],
      cityPulse: {
        headline: "Atlanta is buzzing tonight.",
        summary: "Midtown is active and Buckhead is warming up.",
        facts: [],
        generatedAtIso: new Date().toISOString(),
        freshness: "live",
        actionTargets: [],
      },
      friendsInterestedVenues: [venue],
      friendsInterestedEvents: [event],
    },
  };
}

test("concierge starter prompts stay available", () => {
  assert.equal(conciergeStarterPrompts.length >= 4, true);
});

test("concierge recommendations identify live now intent", () => {
  const result = buildConciergeRecommendations({ ...context(), message: "What is open now and live?" });

  assert.equal(result.intent, "live_now");
  assert.ok(result.recommendedVenues.length > 0);
  assert.ok(result.reply.includes("Top venue picks"));
});

test("concierge recommendations identify genre intent", () => {
  const result = buildConciergeRecommendations({ ...context(), message: "Find hip-hop tonight" });

  assert.equal(result.intent, "genre");
  assert.ok(result.recommendedEvents.length > 0);
  assert.ok(result.followUps.length > 0);
});

test("concierge recommendations identify where-is-everyone intent", () => {
  const result = buildConciergeRecommendations({ ...context(), message: "Where is everyone already downtown or in Midtown?" });

  assert.equal(result.intent, "where_is_everyone");
  assert.ok(result.reply.length > 0);
});

test("concierge recommendations identify budget intent", () => {
  const result = buildConciergeRecommendations({ ...context(), message: "Find clubs everyone can afford under $30" });

  assert.equal(result.intent, "budget");
  assert.ok(result.followUps.some((entry) => entry.toLowerCase().includes("guest-list") || entry.toLowerCase().includes("guest list")));
});
