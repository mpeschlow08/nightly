import type { AskBusinessAnswer, IntelligenceOverview, ProviderKind } from "../types";
import { runAiProvider } from "./ai-provider";
import { deterministicAskResponse } from "./deterministic-provider";

export async function answerBusinessQuestion(input: {
  question: string;
  overview: IntelligenceOverview;
  preferredProvider?: ProviderKind;
}): Promise<AskBusinessAnswer> {
  if (input.preferredProvider === "ai") {
    return runAiProvider({ question: input.question, overview: input.overview });
  }

  const configured = process.env.VENUE_INTELLIGENCE_AI_PROVIDER?.trim();
  if (configured) {
    return runAiProvider({ question: input.question, overview: input.overview });
  }

  return deterministicAskResponse({ question: input.question, overview: input.overview });
}
