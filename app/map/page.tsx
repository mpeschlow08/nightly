import MapPageClient from "@/components/map/MapPageClient";
import { getExploreData } from "@/lib/consumer/data";

export default async function MapPage() {
  const exploreData = await getExploreData();

  return <MapPageClient venues={exploreData.venues} />;
}
