"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/app/lib/audit-log";
import { getCurrentOwnerVenue } from "@/app/owner/lib/ownership";
import {
  askNightlyForBusiness,
  createCampaignDraftFromTopRecommendation,
  runVenueIntelligenceSnapshot,
  saveRecommendationFeedback,
} from "@/lib/venue-intelligence/service";
import { parseAskBusinessInput, parseFeedbackInput } from "@/lib/venue-intelligence/schemas";

function revalidateIntelligenceRoutes() {
  [
    "/owner/intelligence",
    "/owner/intelligence/overview",
    "/owner/intelligence/events",
    "/owner/intelligence/customers",
    "/owner/intelligence/marketing",
    "/owner/intelligence/staffing",
    "/owner/intelligence/inventory",
    "/owner/intelligence/revenue",
    "/owner/intelligence/reports",
    "/owner/intelligence/ask",
  ].forEach((path) => revalidatePath(path));
}

export async function runIntelligenceSnapshotAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const reason = String(formData.get("reason") ?? "manual").trim() || "manual";

  const result = await runVenueIntelligenceSnapshot(reason);

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_forecast_updated",
    metadata: { runId: result.runId, reason },
  });

  revalidateIntelligenceRoutes();
  redirect("/owner/intelligence/overview?snapshot=1");
}

export async function submitBusinessQuestionAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const parsed = parseAskBusinessInput(formData);

  const result = await askNightlyForBusiness(parsed.question, parsed.conversationId);

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_business_answer_viewed",
    metadata: {
      conversationId: result.conversationId,
      provider: result.answer.provenance.providerUsed,
      modelVersion: result.answer.provenance.modelVersion,
    },
  });

  revalidateIntelligenceRoutes();
  redirect(`/owner/intelligence/ask?conversation=${result.conversationId}`);
}

export async function submitInsightFeedbackAction(formData: FormData) {
  const membership = await getCurrentOwnerVenue();
  const parsed = parseFeedbackInput(formData);

  await saveRecommendationFeedback(parsed);

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_insight_feedback_submitted",
    metadata: {
      recommendationId: parsed.recommendationId,
      feedbackType: parsed.feedbackType,
      notesLength: parsed.notes.length,
    },
  });

  revalidateIntelligenceRoutes();
  redirect("/owner/intelligence/marketing?feedback=1");
}

export async function createCampaignDraftAction() {
  const membership = await getCurrentOwnerVenue();
  const draft = await createCampaignDraftFromTopRecommendation();

  await writeAuditLog({
    actorClerkUserId: membership.clerkUserId,
    actorRole: membership.role,
    entityType: "venue_intelligence",
    entityId: membership.venueId,
    action: "venue_campaign_draft_created",
    metadata: {
      draftId: draft.id,
      channel: draft.channel,
    },
  });

  revalidateIntelligenceRoutes();
  redirect("/owner/intelligence/marketing?draft=1");
}
