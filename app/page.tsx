import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import GenreChips from "@/components/GenreChips";
import HappeningTonightSection from "@/components/HappeningTonightSection";
import LiveVibeSection from "@/components/LiveVibeSection";
import PopularNearYouSection from "@/components/PopularNearYouSection";
import CrewPromoSection from "@/components/CrewPromoSection";
import BottomNav from "@/components/BottomNav";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.16),_transparent_32%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_24%)]" />

        <Navbar />

        <main className="pb-24 md:pb-12">
          <Hero />
          <GenreChips />
          <HappeningTonightSection />
          <LiveVibeSection />
          <PopularNearYouSection />
          <CrewPromoSection />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
