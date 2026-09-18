import type { ReactNode } from "react";

import NightlyButton from "@/components/nightly/NightlyButton";

type NightlyEmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; onClick: () => void };
  slot?: ReactNode;
};

export default function NightlyEmptyState({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  slot,
}: NightlyEmptyStateProps) {
  return (
    <div className="nightly-surface-elevated p-5 text-center sm:p-6">
      <p className="text-[0.66rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[color:var(--text-secondary)]">{description}</p>
      {slot ? <div className="mt-4">{slot}</div> : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {primaryAction ? (
            <NightlyButton href={primaryAction.href} variant="primary">
              {primaryAction.label}
            </NightlyButton>
          ) : null}
          {secondaryAction ? (
            <NightlyButton onClick={secondaryAction.onClick} variant="secondary">
              {secondaryAction.label}
            </NightlyButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
