import NightlyBadge from "@/components/nightly/NightlyBadge";

type NightlyLiveBadgeProps = {
  label?: string;
  countLabel?: string | null;
};

export default function NightlyLiveBadge({ label = "Live", countLabel = null }: NightlyLiveBadgeProps) {
  return (
    <div className="nightly-pulse-live inline-flex items-center gap-1.5">
      <NightlyBadge tone="live">{label}</NightlyBadge>
      {countLabel ? <span className="rounded-full bg-black/50 px-2 py-0.5 text-[0.65rem] text-[color:var(--text-secondary)]">{countLabel}</span> : null}
    </div>
  );
}
