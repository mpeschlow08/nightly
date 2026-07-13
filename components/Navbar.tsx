"use client";
import { useState } from "react";
import Link from "next/link";

const navItems = [
  { label: "Discover", href: "/discover" },
  { label: "Map", href: "#map" },
  { label: "Events", href: "#events" },
  { label: "Crews", href: "#crews" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#04070b]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-semibold tracking-[0.24em] text-white">
          NIGHTLY
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/10 md:block">
            Profile
          </button>
          <button
            onClick={() => setOpen((value) => !value)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10 md:hidden"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#04070b]/95 px-4 py-4 text-sm text-zinc-300 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="transition hover:text-white" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="#profile" className="mt-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-center font-medium text-white" onClick={() => setOpen(false)}>
              Profile
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
