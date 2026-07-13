import Link from "next/link";

export default function CrewPromoSection() {
  return (
    <section id="crews" className="mx-auto mt-16 max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.35em] text-pink-300/80">Crew mode</p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Make the plan together.</h2>
          <p className="mt-4 text-base leading-7 text-zinc-300">
            Create a Crew, invite friends by link, vote on venues, and track RSVPs in one polished flow so the night comes together without the group chat chaos.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/crews" className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90">
            Create a Crew
          </Link>
          <Link href="/crews" className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-400/40 hover:text-white">
            See how it works
          </Link>
        </div>
      </div>
    </section>
  );
}
