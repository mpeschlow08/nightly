"use client";

import NightlyChip from "@/components/nightly/NightlyChip";

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
          <NightlyChip
            key={chip}
            onClick={() => onToggle(chip)}
            label={chip}
            active={isSelected}
            className="snap-start"
          />
        );
      })}
    </div>
  );
}
