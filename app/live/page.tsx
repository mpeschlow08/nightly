import NightlyLiveClient from "@/components/live/NightlyLiveClient";
import { getLiveData } from "@/lib/consumer/data";

export default async function NightlyLivePage() {
  const liveData = await getLiveData();

  return <NightlyLiveClient data={liveData} />;
}
