import type { ReactNode } from "react";

type NightlyBadgeTone = "neutral" | "live" | "special";

type NightlyBadgeProps = {
  children: ReactNode;
  tone?: NightlyBadgeTone;
  className?: string;
};

export default function NightlyBadge({ children, tone = "neutral", className }: NightlyBadgeProps) {
  const toneClassName = tone === "live" ? "nightly-badge-live" : tone === "special" ? "nightly-badge-special" : "";

  return <span className={`nightly-badge ${toneClassName} ${className ?? ""}`}>{children}</span>;
}
