import { genres } from "@/data/nightly";

export default function GenreChips() {
  return (
    <section className="mx-auto mt-8 flex max-w-7xl flex-wrap gap-3 px-4 sm:px-6 lg:px-8">
      {genres.map((genre) => (
        <button
          key={genre}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:bg-white/10"
        >
          {genre}
        </button>
      ))}
    </section>
  );
}
