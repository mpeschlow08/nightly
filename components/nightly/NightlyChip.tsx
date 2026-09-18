type NightlyChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export default function NightlyChip({ label, active = false, onClick, className }: NightlyChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={`nightly-chip shrink-0 ${className ?? ""}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
