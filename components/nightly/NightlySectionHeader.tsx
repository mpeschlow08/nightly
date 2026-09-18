import Link from "next/link";

type NightlySectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
  className?: string;
};

export default function NightlySectionHeader({
  eyebrow,
  title,
  subtitle,
  href,
  actionLabel = "See all",
  className,
}: NightlySectionHeaderProps) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-3 ${className ?? ""}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{eyebrow}</p> : null}
        <h2 className="nightly-section-title mt-1 line-clamp-1">{title}</h2>
        {subtitle ? <p className="mt-1 line-clamp-2 text-sm text-[color:var(--text-secondary)]">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="nightly-btn-secondary shrink-0 rounded-full border border-[color:var(--border)] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)]">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
