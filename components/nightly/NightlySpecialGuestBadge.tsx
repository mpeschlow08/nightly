import NightlyBadge from "@/components/nightly/NightlyBadge";

type NightlySpecialGuestBadgeProps = {
  badge: string;
  title: string;
  subtitle?: string | null;
  additionalCount?: number;
  verificationBadge?: string | null;
  className?: string;
};

export default function NightlySpecialGuestBadge({
  badge,
  title,
  subtitle,
  additionalCount = 0,
  verificationBadge,
  className,
}: NightlySpecialGuestBadgeProps) {
  return (
    <div className={`rounded-xl border border-amber-300/45 bg-black/66 px-3 py-2 backdrop-blur ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <NightlyBadge tone="special">{badge}</NightlyBadge>
        {additionalCount > 0 ? (
          <span className="rounded-full border border-amber-300/40 bg-amber-500/16 px-2 py-0.5 text-[0.65rem] text-amber-100">
            +{additionalCount} more
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-amber-50">{title}</p>
      {subtitle ? (
        <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-amber-100/90">
          {verificationBadge ? `${verificationBadge} · ` : ""}
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
