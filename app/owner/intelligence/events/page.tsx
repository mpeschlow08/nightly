import OwnerIntelligenceDashboard from "@/components/venue-intelligence/OwnerIntelligenceDashboard";
import { getOwnerIntelligenceOverview } from "@/lib/venue-intelligence/service";

export default async function OwnerIntelligenceEventsPage() {
  const overview = await getOwnerIntelligenceOverview();
  return <OwnerIntelligenceDashboard moduleKey="events" overview={overview} />;
}
