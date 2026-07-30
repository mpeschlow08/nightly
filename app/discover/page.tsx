import DiscoverClient from "@/components/discover/DiscoverClient";
import { getExploreData } from "@/lib/consumer/data";

export default async function DiscoverPage() {
  const exploreData = await getExploreData();

  return <DiscoverClient initialData={exploreData} />;
}
