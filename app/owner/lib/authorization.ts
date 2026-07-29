import { getCurrentOwnerVenue } from "./ownership";

export async function requireAuthorizedOwnerForVenue(venueId: number) {
  const ownership = await getCurrentOwnerVenue();

  if (ownership.venueId !== venueId) {
    throw new Error("Forbidden. You are not authorized to manage this venue.");
  }

  return {
    userId: ownership.clerkUserId,
    venueId: ownership.venueId,
    role: ownership.role,
    venue: ownership.venue,
  };
}
