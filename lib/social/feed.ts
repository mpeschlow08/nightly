export type SocialActivityType =
  | "saved_event"
  | "bought_ticket"
  | "joined_guest_list"
  | "checked_into_venue"
  | "booked_dj"
  | "started_night_out"
  | "created_group"
  | "shared_itinerary"
  | "friend_joined_venue"
  | "trending_among_friends";

export function socialActivityLabel(type: SocialActivityType) {
  switch (type) {
    case "saved_event":
      return "Saved event";
    case "bought_ticket":
      return "Bought ticket";
    case "joined_guest_list":
      return "Joined guest list";
    case "checked_into_venue":
      return "Checked into venue";
    case "booked_dj":
      return "Booked DJ";
    case "started_night_out":
      return "Started Night Out";
    case "created_group":
      return "Created group";
    case "shared_itinerary":
      return "Shared itinerary";
    case "friend_joined_venue":
      return "Friend joined venue";
    case "trending_among_friends":
      return "Trending among friends";
    default:
      return type;
  }
}
