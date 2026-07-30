"use client";

type ExploreFilterChipsProps = {
  chips: readonly string[];
  selected: string[];
  onToggle: (chip: string) => void;
};

export default function ExploreFilterChips({
  chips,
  selected,
  onToggle,
}: ExploreFilterChipsProps) {
  return (
    <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {chips.map((chip) => {
        const isSelected = selected.includes(chip);

        return (
          <button
            key={chip}
            type="button"
            onClick={() => onToggle(chip)}
            className={`min-h-10 shrink-0 snap-start rounded-full border px-4 text-xs font-medium transition ${
              isSelected
                ? "border-violet-300/45 bg-violet-500/80 text-white"
                : "border-white/12 bg-white/5 text-zinc-300"
            }`}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
