import Link from "next/link";

export default function CrewPromoSection() {
  return (
    <section id="link-up" className="mx-auto mt-7 max-w-3xl px-4 pb-24 sm:px-5 lg:px-6">
      <div className="rounded-[1.25rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4 shadow-[0_14px_44px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-5">
        <p className="text-[11px] uppercase tracking-[0.3em] text-pink-300/80">Link Up Preview</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Make tonight&apos;s plan together.</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">Create a crew, vote on spots, and lock in where everyone meets.</p>

        <div className="mt-4 flex gap-2">
          <Link
            href="/crews"
            className="min-h-10 flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            Open Link Up
          </Link>
          <button className="min-h-10 rounded-full border border-white/15 px-4 py-2.5 text-sm text-zinc-200">
            Invite
          </button>
        </div>
      </div>
    </section>
  );
}
