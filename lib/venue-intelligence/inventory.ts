import { buildProvenance } from "./provenance";
import type { InventoryRecommendation } from "./types";

export type InventorySignalItem = {
  itemId: number;
  itemName: string;
  onHand: number;
  par: number;
  recentConsumption: number;
  reorderThreshold: number;
};

export function buildInventoryForecast(input: {
  forecastAttendance: number;
  tableReservations: number;
  vipReservations: number;
  items: InventorySignalItem[];
  lastDataAt: Date | null;
}): InventoryRecommendation[] {
  const serviceFactor = 1 + input.tableReservations * 0.012 + input.vipReservations * 0.02;

  return input.items.map((item) => {
    const expectedConsumption = Math.max(0, Math.round(item.recentConsumption * serviceFactor));
    const recommendedAvailable = Math.max(item.par, expectedConsumption + Math.round(input.forecastAttendance * 0.03));
    const reorderQuantity = Math.max(0, recommendedAvailable - item.onHand);
    const shortageRisk = item.onHand <= item.reorderThreshold ? 0.8 : item.onHand < expectedConsumption ? 0.65 : 0.2;
    const overstockRisk = item.onHand > recommendedAvailable * 1.4 ? 0.6 : 0.15;

    return {
      itemId: item.itemId,
      itemName: item.itemName,
      expectedConsumption,
      recommendedAvailable,
      reorderQuantity,
      shortageRisk,
      overstockRisk,
      status: "estimated",
      assumptions: [
        "Consumption modeled from recent movement patterns.",
        "Demand scales with table and VIP reservation load.",
      ],
      provenance: buildProvenance({
        sourceType: "derived",
        sourceTables: ["venue_inventory_items", "venue_inventory_movements", "venue_vip_reservations"],
        lastDataAt: input.lastDataAt,
        sampleSize: input.items.length,
        confidenceLevel: input.items.length >= 5 ? "medium" : "low",
        confidenceScore: input.items.length >= 5 ? 0.62 : 0.45,
        status: "estimated",
        limitations: ["Auto-ordering is disabled; reorder output is advisory only."],
        isEstimated: true,
      }),
    };
  });
}
