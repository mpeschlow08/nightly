import type { ReactNode } from "react";

type EmptyStateIcon = "events" | "friends" | "mixes" | "gallery" | "venues";

type EmptyStateCardProps = {
  icon: EmptyStateIcon;
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
  actions?: ReactNode;
  className?: string;
};

function IconGlyph({ icon }: { icon: EmptyStateIcon }) {
  if (icon === "events") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 3.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 3.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 9.5H20" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 13H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "friends") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16.5" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.5 18C5.2 15.8 7 14.5 9 14.5C11 14.5 12.8 15.8 13.5 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14.5 17.5C15 16.2 16.2 15.5 17.5 15.5C18.6 15.5 19.6 16 20.2 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "mixes") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <circle cx="8" cy="15.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="13.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 15.5V6.5L18.5 5V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === "gallery") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 17L11 12.5L14 15.5L16 13.5L19 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M3.5 9.5L12 4L20.5 9.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 13.5H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 16.5H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function EmptyStateCard({
  icon,
  eyebrow,
  title,
  description,
  note,
  actions,
  className,
}: EmptyStateCardProps) {
  return (
    <div
      className={`nightly-card rounded-[1.7rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_42%),linear-gradient(145deg,_rgba(9,13,24,0.88)_0%,_rgba(7,10,19,0.9)_100%)] p-7 text-center backdrop-blur-xl ${className ?? ""}`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/35 bg-cyan-500/12 text-cyan-100">
        <IconGlyph icon={icon} />
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.32em] text-cyan-200/80">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-300">{description}</p>
      {note ? <p className="mx-auto mt-3 max-w-xl text-xs leading-6 text-zinc-400">{note}</p> : null}

      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div> : null}
    </div>
  );
}