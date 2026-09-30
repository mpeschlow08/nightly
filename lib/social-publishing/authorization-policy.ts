export function mayManageSocialPublishing(input: {
  isActiveUser: boolean;
  venueMembershipRole: string | null;
  venueMatches: boolean;
}) {
  return input.isActiveUser && input.venueMatches && input.venueMembershipRole === "owner";
}
