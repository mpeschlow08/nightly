type LiveActivity = {
  id: string;
  label: string;
  detail: string;
  occurredAtLabel: string;
};

type Props = {
  item: LiveActivity;
};

function dotClass(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("live")) return "bg-emerald-300";
  if (normalized.includes("crowd") || normalized.includes("packed")) return "bg-fuchsia-300";
  if (normalized.includes("event") || normalized.includes("set")) return "bg-violet-300";

  return "bg-cyan-300";
}

export default function LiveActivityItem({ item }: Props) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(item.label)}`} />
          <div>
            <p className="text-sm text-zinc-100">{item.label}</p>
            <p className="text-xs text-zinc-400">{item.detail}</p>
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-zinc-400">{item.occurredAtLabel}</span>
      </div>
    </article>
  );
}
