import { getServerFeatureFlagState } from "@/app/admin/lib/feature-flags";

export type FeatureAccessContext = {
  environment?: string;
  role?: string;
  userId?: string;
  venueId?: string | number;
  city?: string;
};

export async function isFeatureEnabled(flagKey: string, context: FeatureAccessContext) {
  const state = await getServerFeatureFlagState(flagKey, {
    ...context,
    venueId: typeof context.venueId === "number" ? String(context.venueId) : context.venueId,
  });

  return state.enabled && state.source !== "missing";
}

export async function assertFeatureEnabled(
  flagKey: string,
  context: FeatureAccessContext,
  message: string
) {
  if (!(await isFeatureEnabled(flagKey, context))) {
    throw new Error(message);
  }
}