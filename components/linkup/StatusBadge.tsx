import { statusPresentation, type FriendStatus } from "@/data/link-up";

type Props = {
  status: FriendStatus;
};

export default function StatusBadge({ status }: Props) {
  const presentation = statusPresentation[status];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${presentation.badgeClassName}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${presentation.indicatorClassName}`} />
      {presentation.label}
    </span>
  );
}
