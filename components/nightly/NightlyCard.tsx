import type { ReactNode } from "react";

type NightlyCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export default function NightlyCard({ children, className, interactive = false }: NightlyCardProps) {
  return (
    <div className={`nightly-card ${interactive ? "nightly-card-interactive" : ""} ${className ?? ""}`}>
      {children}
    </div>
  );
}
