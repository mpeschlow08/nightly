export type MetricTrend = "up" | "down" | "flat";

export type MetricItem = {
  label: string;
  value: string;
  delta?: string;
  trend?: MetricTrend;
  detail?: string;
};

export type DateFilterKey = "7d" | "30d" | "90d";
