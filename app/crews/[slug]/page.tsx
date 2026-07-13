import { notFound } from "next/navigation";

import CrewDetailClient from "@/components/CrewDetailClient";
import { getCrewBySlug, getCrewSlugs } from "@/data/crews";

export function generateStaticParams() {
  return getCrewSlugs();
}

export default function CrewDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return <CrewDetailPageContent params={params} />;
}

async function CrewDetailPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const crew = getCrewBySlug(slug);

  if (!crew) {
    notFound();
  }

  return <CrewDetailClient crew={crew} />;
}
