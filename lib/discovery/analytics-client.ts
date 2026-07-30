"use client";

type DiscoveryEventName =
  | "recommendation_impression"
  | "recommendation_click"
  | "recommendation_save"
  | "recommendation_share"
  | "recommendation_dismiss"
  | "filter_applied"
  | "city_pulse_opened"
  | "live_recommendation_opened";

export async function trackDiscoveryInteraction(input: {
  event: DiscoveryEventName;
  recommendationType?: string;
  itemId?: number | string;
  rankPosition?: number;
  explanationCategory?: string;
  activeFilters?: string[];
}) {
  try {
    await fetch("/api/discovery/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // Preserve non-blocking UX and avoid throwing on analytics failures.
  }
}
