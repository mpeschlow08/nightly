import { notFound } from "next/navigation";

import LiveVenueStreamClient from "@/components/live/LiveVenueStreamClient";
import { getVenueBySlug } from "@/lib/consumer/data";

type LiveVenuePageProps = {
  params: Promise<{ venue: string }>;
};

export default async function LiveVenuePage({ params }: LiveVenuePageProps) {
  const { venue } = await params;
  const detail = await getVenueBySlug(venue);

  if (!detail) {
    notFound();
  }

  const venueHref = detail.slug ? `/venues/${detail.slug}` : `/venues/${detail.id}`;

  return (
    <div className="min-h-screen bg-[#04070b] px-4 py-6 sm:px-6 lg:px-8">
      <LiveVenueStreamClient venueSlugOrId={venue} venueName={detail.name} venueHref={venueHref} />
    </div>
  );
}
