import Link from "next/link";

const ownerLinks = [
  { href: "/owner", label: "Dashboard", description: "Portal overview" },
  { href: "/owner/venue", label: "Venue", description: "Edit venue details" },
  { href: "/owner/hours", label: "Hours", description: "Business operating hours" },
  { href: "/owner/images", label: "Images", description: "Manage gallery" },
  { href: "/owner/events", label: "Events", description: "Manage event schedule" },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,179,255,0.16),_transparent_45%),linear-gradient(140deg,_#04070b_0%,_#080c13_40%,_#0a1020_100%)] text-zinc-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:gap-8 lg:px-8 lg:py-10">
        <aside className="rounded-[1.6rem] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_0_70px_rgba(34,211,238,0.08)] backdrop-blur-xl lg:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Nightly Owner</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Venue Portal</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Manage one mock-owner venue while Clerk role ownership is being integrated.
          </p>

          <nav className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {ownerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-1 text-xs text-zinc-400">{item.description}</p>
              </Link>
            ))}
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
