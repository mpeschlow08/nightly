import Hero from "@/components/Hero";
import GenreChips from "@/components/GenreChips";
import HappeningTonightSection from "@/components/HappeningTonightSection";
import LiveVibeSection from "@/components/LiveVibeSection";
import PopularNearYouSection from "@/components/PopularNearYouSection";
import CrewPromoSection from "@/components/CrewPromoSection";
import Link from "next/link";

export default function ConsumerHomePage() {
  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.16),_transparent_32%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_24%)]" />

        <main className="pb-24 md:pb-12">
          <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <div className="flex justify-end">
              <Link
                href="/select-role?changeRole=1"
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/10"
              >
                Switch Account Type
              </Link>
            </div>
          </section>

          <Hero />
          <GenreChips />
          <HappeningTonightSection />
          <LiveVibeSection />
          <PopularNearYouSection />
          <CrewPromoSection />
        </main>
      </div>
    </div>
  );
}
