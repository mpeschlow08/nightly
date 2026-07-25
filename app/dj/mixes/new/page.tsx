import Link from "next/link";

import { DjMixUploadForm } from "@/components/dj/DjMixUploadForm";

import { requireDjProfileForDashboard } from "../../lib/data";

export default async function DjMixNewPage() {
  const { profile } = await requireDjProfileForDashboard();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Sample Mix Upload</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Upload a new mix</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Publish a polished sample mix for your public DJ profile and venue discovery.
            </p>
          </div>
          <Link
            href="/dj/mixes"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:text-white"
          >
            Manage mixes
          </Link>
        </div>

        <div className="mt-6">
          <DjMixUploadForm djProfileId={profile.id} />
        </div>
      </div>
    </main>
  );
}
