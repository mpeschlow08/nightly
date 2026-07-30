import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export default function LinkUpSectionHeader({ eyebrow, title, subtitle, action }: Props) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200/75">{eyebrow}</p> : null}
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-300">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
