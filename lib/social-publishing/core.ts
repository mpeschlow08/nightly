import type { SocialPublicationLifecycle } from "./types";

export const SOCIAL_PUBLICATION_TRANSITIONS: Record<SocialPublicationLifecycle, SocialPublicationLifecycle[]> = {
  draft: ["queued", "failed"],
  queued: ["processing", "published", "failed", "revoked"],
  processing: ["ready", "published", "failed", "revoked"],
  ready: ["published", "failed", "revoked"],
  published: ["revoked"],
  failed: ["queued", "revoked"],
  revoked: [],
};

export function transitionSocialPublicationState(currentState: SocialPublicationLifecycle, nextState: SocialPublicationLifecycle): SocialPublicationLifecycle {
  const allowed = SOCIAL_PUBLICATION_TRANSITIONS[currentState] ?? [];
  if (currentState === nextState) return currentState;
  if (!allowed.includes(nextState)) {
    throw new Error(`invalid_transition:${currentState}->${nextState}`);
  }
  return nextState;
}
