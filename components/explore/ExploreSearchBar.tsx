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
      <div className="nightly-surface mx-auto flex max-w-6xl items-center gap-2 rounded-[1.1rem] p-2.5">
        <div className="flex min-h-10 w-10 items-center justify-center rounded-full bg-black/36 text-[color:var(--text-secondary)]" aria-hidden="true">
          <span className="text-sm">⌕</span>
        </div>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search venues, events, special guests"
          className="min-h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
          aria-label="Search explore"
        />

        <button
          type="button"
          className="nightly-btn-secondary min-h-10 rounded-full border border-[color:var(--border)] bg-white/[0.03] px-3 text-xs font-medium text-[color:var(--text-secondary)]"
          aria-label="Voice search coming soon"
          title="Voice search coming soon"
        >
          Mic
        </button>

        {hasValue ? (
          <button
            type="button"
            onClick={onClear}
            className="nightly-btn-secondary min-h-10 rounded-full border border-[color:var(--border)] bg-white/[0.03] px-3 text-xs font-medium text-[color:var(--text-secondary)]"
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenFilters}
          className="nightly-btn-secondary min-h-10 rounded-full border border-violet-300/45 bg-violet-500/20 px-3 text-xs font-medium text-violet-100"
          aria-label="Open filters"
        >
          Filters
        </button>
      </div>
    </div>
  );
}
