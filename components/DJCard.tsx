import DJImage from "@/components/media/DJImage";

type DJCardProps = {
  name: string;
  genre?: string;
  imageUrl?: string | null;
};

export default function DJCard({ name, genre, imageUrl }: DJCardProps) {
  return (
    <article className="nightly-card nightly-card-interactive overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/60 shadow-md transition-transform hover:scale-[1.02]">
      <div className="relative">
        <DJImage src={imageUrl ?? null} alt={`${name} portrait`} className="rounded-none" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 text-white">
          <div className="text-sm opacity-90">{genre}</div>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        <p className="mt-2 text-sm text-gray-300">International headliner · Live sets weekly</p>
        <div className="mt-4">
          <button className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm text-white">View Profile</button>
        </div>
      </div>
    </article>
  );
}
