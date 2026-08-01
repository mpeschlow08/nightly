export type AskBusinessInput = {
  question: string;
  conversationId?: number | null;
};

export function parseAskBusinessInput(raw: FormData): AskBusinessInput {
  const question = String(raw.get("question") ?? "").trim();
  const conversationIdRaw = String(raw.get("conversationId") ?? "").trim();
  const conversationId = conversationIdRaw ? Number(conversationIdRaw) : null;

  if (!question) {
    throw new Error("Question is required.");
  }

  if (question.length > 1200) {
    throw new Error("Question is too long.");
  }

  return {
    question,
    conversationId: Number.isFinite(conversationId) ? conversationId : null,
  };
}

export function parseFeedbackInput(raw: FormData) {
  const recommendationId = Number(String(raw.get("recommendationId") ?? ""));
  const feedbackType = String(raw.get("feedbackType") ?? "").trim();
  const notes = String(raw.get("notes") ?? "").trim();

  if (!Number.isFinite(recommendationId) || recommendationId <= 0) {
    throw new Error("Recommendation ID is required.");
  }

  if (!feedbackType) {
    throw new Error("Feedback type is required.");
  }

  return { recommendationId, feedbackType, notes };
}
