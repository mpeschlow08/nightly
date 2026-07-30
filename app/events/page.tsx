import EventsClient from "@/components/events/EventsClient";
import { getUpcomingEvents } from "@/lib/consumer/data";

export default async function EventsPage() {
  const events = await getUpcomingEvents(120);

  return <EventsClient initialEvents={events} />;
}
