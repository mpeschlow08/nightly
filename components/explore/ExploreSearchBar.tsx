"use client";

import { useMemo } from "react";

type ExploreSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onOpenFilters: () => void;
};

export default function ExploreSearchBar({
  value,
  onChange,
  onClear,
  onOpenFilters,
}: ExploreSearchBarProps) {
  const hasValue = useMemo(() => value.trim().length > 0, [value]);

  return (
    <div className="px-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-[1.1rem] border border-white/12 bg-white/6 p-2 backdrop-blur-xl">
        <div className="flex min-h-10 w-10 items-center justify-center rounded-full bg-black/30 text-zinc-300" aria-hidden="true">
          <span className="text-sm">⌕</span>
        </div>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search venues, DJs, events, neighborhoods, genres"
          className="min-h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-zinc-500"
          aria-label="Search explore"
        />

        <button
          type="button"
          className="nightly-btn-secondary min-h-10 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-medium text-zinc-300"
          aria-label="Voice search coming soon"
          title="Voice search coming soon"
        >
          Mic
        </button>

        {hasValue ? (
          <button
            type="button"
            onClick={onClear}
            className="nightly-btn-secondary min-h-10 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-medium text-zinc-300"
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenFilters}
          className="nightly-btn-secondary min-h-10 rounded-full border border-violet-300/35 bg-violet-500/15 px-3 text-xs font-medium text-violet-100"
          aria-label="Open filters"
        >
          Filters
        </button>
      </div>
    </div>
  );
}
