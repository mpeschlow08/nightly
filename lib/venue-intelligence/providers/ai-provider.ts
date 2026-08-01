import type { AskBusinessAnswer, IntelligenceOverview } from "../types";
import { deterministicAskResponse } from "./deterministic-provider";

export function aiProviderConfigured() {
  return Boolean(process.env.VENUE_INTELLIGENCE_AI_PROVIDER?.trim() && process.env.VENUE_INTELLIGENCE_AI_KEY?.trim());
}

export async function runAiProvider(input: { question: string; overview: IntelligenceOverview; timeoutMs?: number }): Promise<AskBusinessAnswer> {
  const timeoutMs = input.timeoutMs ?? 2500;

  if (!aiProviderConfigured()) {
    return deterministicAskResponse(input);
  }

  const timeout = new Promise<AskBusinessAnswer>((resolve) => {
    setTimeout(() => resolve(deterministicAskResponse(input)), timeoutMs);
  });

  return timeout;
}
