import OwnerIntelligenceDashboard from "@/components/venue-intelligence/OwnerIntelligenceDashboard";
import { getOwnerIntelligenceOverview } from "@/lib/venue-intelligence/service";

export default async function OwnerIntelligenceReportsPage() {
  const overview = await getOwnerIntelligenceOverview();
  return <OwnerIntelligenceDashboard moduleKey="reports" overview={overview} />;
}
