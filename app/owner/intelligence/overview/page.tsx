import OwnerIntelligenceDashboard from "@/components/venue-intelligence/OwnerIntelligenceDashboard";
import { getOwnerIntelligenceOverview } from "@/lib/venue-intelligence/service";

export default async function OwnerIntelligenceOverviewPage() {
  const overview = await getOwnerIntelligenceOverview();
  return <OwnerIntelligenceDashboard moduleKey="overview" overview={overview} />;
}
