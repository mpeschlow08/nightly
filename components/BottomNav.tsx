import Link from "next/link";

const items = [
  { label: "Home", href: "/" },
  { label: "Discover", href: "/discover" },
  { label: "Map", href: "/map" },
  { label: "Events", href: "/events" },
  { label: "Crews", href: "/crews" },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#04070b]/90 px-3 py-3 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 text-[11px] text-zinc-400">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-1 flex-col items-center rounded-2xl px-2 py-2 transition hover:bg-white/10 hover:text-white">
            <span className="mb-1 h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
