import type { VenueOsAiInsightRequest } from "./types";

export type VenueOsAiProvider = "azure" | "openai" | "anthropic" | "noop";

export type VenueOsAiInsightResult = {
  provider: VenueOsAiProvider;
  status: "pending" | "ready" | "failed";
  summary: string;
  output: Record<string, unknown> | null;
};

export interface VenueOsAiAdapter {
  readonly provider: VenueOsAiProvider;
  requestInsight(input: VenueOsAiInsightRequest): Promise<VenueOsAiInsightResult>;
}

class NoopVenueOsAiAdapter implements VenueOsAiAdapter {
  readonly provider = "noop" as const;

  async requestInsight(input: VenueOsAiInsightRequest): Promise<VenueOsAiInsightResult> {
    return {
      provider: this.provider,
      status: "pending",
      summary: `Insight request queued for ${input.insightType.replace(/_/g, " ")}. No provider output is configured in this environment.`,
      output: null,
    };
  }
}

export function createVenueOsAiAdapter(provider?: VenueOsAiProvider): VenueOsAiAdapter {
  const configured = provider ?? (process.env.VENUE_OS_AI_PROVIDER?.trim().toLowerCase() as VenueOsAiProvider | undefined);

  if (configured === "azure" || configured === "openai" || configured === "anthropic") {
    return new NoopVenueOsAiAdapter();
  }

  return new NoopVenueOsAiAdapter();
}

export function buildVenueOsInsightSeed(input: VenueOsAiInsightRequest) {
  return {
    insightType: input.insightType,
    venueId: input.venueId,
    eventId: input.eventId ?? null,
    receivedInputKeys: Object.keys(input.input),
  };
}