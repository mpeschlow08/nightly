import Link from "next/link";

type HeroProps = {
  greeting: string;
  title: string;
  subtitle: string;
};

export default function Hero({ greeting, title, subtitle }: HeroProps) {
  return (
    <section id="discover" className="mx-auto max-w-3xl px-4 pb-5 pt-3 sm:px-5 lg:px-6">
      <div className="nightly-fade-in overflow-hidden rounded-[1.3rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_48%),linear-gradient(145deg,_rgba(8,12,20,0.95),_rgba(3,7,13,0.96))] px-4 py-4 shadow-[0_20px_58px_rgba(0,0,0,0.42)] sm:px-5 sm:py-5">
        <p className="text-xs font-medium tracking-[0.02em] text-zinc-300">{greeting}</p>
        <h1 className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.85rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-[34ch] text-sm leading-6 text-zinc-300">
          {subtitle}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Link
            href="/discover"
            className="nightly-btn-primary min-h-11 flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-center text-sm font-medium text-white"
          >
            Explore Tonight
          </Link>
          <Link
            href="/map"
            className="nightly-btn-secondary min-h-11 rounded-full border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-medium text-zinc-200"
          >
            Open Map
          </Link>
        </div>
      </div>
    </section>
  );
}
