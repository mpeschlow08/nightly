"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_42%),radial-gradient(circle_at_82%_14%,_rgba(167,139,250,0.12),_transparent_30%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#0d1322_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center rounded-[2rem] border border-white/10 bg-zinc-950/70 p-8 text-center shadow-[0_25px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-12">
        <Image
          src="/assets/nightly-logo.png"
          alt="Nightly"
          width={140}
          height={40}
          className="h-10 w-auto"
          priority
        />

        <p className="mt-8 inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-cyan-100">
          404 • Page Not Found
        </p>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          This stop is off tonight&apos;s route.
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
          The page may have moved, the link may be old, or this route never opened. Let&apos;s get you back to the Nightly flow.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
          >
            <span aria-hidden="true">←</span>
            Back
          </button>

          <Link
            href="/home"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Return Home
          </Link>
        </div>
      </section>
    </main>
  );
}