import { genres } from "@/data/nightly";

export default function GenreChips() {
  return (
    <section className="mx-auto mt-5 flex max-w-3xl gap-2 overflow-x-auto px-4 pb-1 sm:px-5 lg:px-6 [scrollbar-width:none]">
      {genres.map((genre) => (
        <button
          key={genre}
          className="min-h-9 shrink-0 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-200"
        >
          {genre}
        </button>
      ))}
    </section>
  );
}
