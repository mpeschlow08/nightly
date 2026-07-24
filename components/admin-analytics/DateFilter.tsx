import { DateFilterKey } from "@/components/admin-analytics/types";

type DateFilterProps = {
  selected: DateFilterKey;
  onChange: (next: DateFilterKey) => void;
};

const dateOptions: { key: DateFilterKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
];

export default function DateFilter({ selected, onChange }: DateFilterProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/25 p-1.5">
      {dateOptions.map((option) => {
        const active = selected === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium tracking-[0.16em] transition ${
              active
                ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
                : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
