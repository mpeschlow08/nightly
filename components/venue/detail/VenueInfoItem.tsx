type VenueInfoItemProps = {
  icon: string;
  label: string;
  value: string;
};

export default function VenueInfoItem({ icon, label, value }: VenueInfoItemProps) {
  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/25 text-xs text-zinc-200" aria-hidden="true">
          {icon}
        </span>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-100">{value}</p>
    </article>
  );
}
