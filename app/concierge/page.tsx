import ConciergeClient from "@/components/concierge/ConciergeClient";
import { getExploreData, getHomeData } from "@/lib/consumer/data";
import { conciergeStarterPrompts } from "@/lib/concierge/service";

export default async function ConciergePage() {
  const [homeData, exploreData] = await Promise.all([getHomeData(), getExploreData()]);

  return (
    <ConciergeClient
      homeData={homeData}
      exploreData={exploreData}
      starterPrompts={conciergeStarterPrompts}
    />
  );
}