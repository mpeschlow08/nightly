"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

type AppRole = "consumer" | "dj" | "owner" | "admin" | null;

type NavItem = {
  label: string;
  href?: string;
  comingSoon?: boolean;
};

type AppNavigationProps = {
  role: AppRole;
  children: React.ReactNode;
};

const roleFallbackByHistory: Record<Exclude<AppRole, null>, string> = {
  consumer: "/home",
  dj: "/dj/dashboard",
  owner: "/owner/dashboard",
  admin: "/admin",
};

const roleItems: Record<Exclude<AppRole, null>, NavItem[]> = {
  consumer: [
    { label: "Home", href: "/home" },
    { label: "Explore", href: "/discover" },
    { label: "Map", href: "/map" },
    { label: "Events", href: "/events" },
    { label: "Friends", href: "/crews" },
    { label: "Messages", comingSoon: true },
    { label: "Profile", href: "/profile" },
    { label: "Settings", href: "/profile" },
    { label: "Switch Account Type", href: "/select-role?changeRole=1" },
  ],
  dj: [
    { label: "Dashboard", href: "/dj/dashboard" },
    { label: "Edit Profile", href: "/dj/onboarding" },
    { label: "Upload Mix", href: "/dj/mixes/new" },
    { label: "Manage Mixes", href: "/dj/mixes" },
    { label: "Public Profile", href: "/dj/profile" },
    { label: "Bookings", comingSoon: true },
    { label: "Analytics", comingSoon: true },
    { label: "Switch Account Type", href: "/select-role?changeRole=1" },
  ],
  owner: [
    { label: "Dashboard", href: "/owner/dashboard" },
    { label: "Venue Profile", href: "/owner/venue" },
    { label: "Events", href: "/owner/events" },
    { label: "Gallery", href: "/owner/images" },
    { label: "Analytics", href: "/owner/dashboard" },
    { label: "Staff", comingSoon: true },
    { label: "Settings", href: "/profile" },
    { label: "Switch Account Type", href: "/select-role?changeRole=1" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin" },
    { label: "Users", comingSoon: true },
    { label: "Venues", comingSoon: true },
    { label: "DJs", comingSoon: true },
    { label: "Reports", comingSoon: true },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Settings", href: "/profile" },
  ],
};

const hiddenPathPrefixes = ["/sign-in", "/sign-up", "/select-role"];

function isCurrentPath(pathname: string, href: string) {
  if (href.includes("?")) {
    return pathname === href.split("?")[0];
  }

  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }

  if (href === "/owner/dashboard") {
    return pathname === "/owner" || pathname === "/owner/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function segmentLabel(segment: string) {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Welcome";
  if (pathname === "/home") return "Home";
  if (pathname === "/discover") return "Explore";
  if (pathname === "/map") return "Map";
  if (pathname === "/events") return "Events";
  if (pathname.startsWith("/events/")) return "Event Details";
  if (pathname === "/crews") return "Friends";
  if (pathname.startsWith("/crews/")) return "Crew Details";
  if (pathname === "/profile") return "Profile";
  if (pathname === "/dj/dashboard") return "DJ Dashboard";
  if (pathname === "/dj/onboarding") return "Edit DJ Profile";
  if (pathname === "/dj/mixes") return "Manage Mixes";
  if (pathname === "/dj/mixes/new") return "Upload Mix";
  if (pathname.startsWith("/dj/profile/")) return "Public DJ Profile";
  if (pathname === "/owner" || pathname === "/owner/dashboard") return "Owner Dashboard";
  if (pathname === "/owner/venue") return "Venue Profile";
  if (pathname === "/owner/events") return "Owner Events";
  if (pathname === "/owner/images") return "Owner Gallery";
  if (pathname === "/owner/hours") return "Business Hours";
  if (pathname === "/admin" || pathname === "/admin/analytics") return "Admin Analytics";
  if (pathname.startsWith("/venues/")) return "Venue Details";
  return segmentLabel(pathname.split("/").filter(Boolean).at(-1) ?? "Nightly");
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Home", href: "/" }];
  }

  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isDynamicLike = /^\d+$/.test(segment) || index > 0 && ["events", "crews", "venues", "profile"].includes(segments[index - 1]);

    return {
      label: isDynamicLike ? "Details" : segmentLabel(segment),
      href,
    };
  });
}

function PlaceholderIcon({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-zinc-300" aria-hidden="true">
      {label}
    </span>
  );
}

export default function AppNavigation({ role, children }: AppNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn } = useUser();

  const shouldHide = hiddenPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const activeRole: Exclude<AppRole, null> = role ?? "consumer";
  const navItems = roleItems[activeRole];
  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname]);

  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(roleFallbackByHistory[activeRole]);
  };

  if (shouldHide) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/10 bg-zinc-950/70 px-4 py-6 backdrop-blur-xl lg:block">
          <Link href="/" className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5">
            <Image src="/assets/nightly-logo.png" alt="Nightly" width={120} height={34} className="h-9 w-auto" priority />
          </Link>

          <div className="mt-6 px-2">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{activeRole} navigation</p>
          </div>

          <nav className="mt-3 space-y-1 px-1">
            {navItems.map((item) => {
              const active = item.href ? isCurrentPath(pathname, item.href) : false;

              if (item.comingSoon || !item.href) {
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>{item.label}</span>
                      <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                        Soon
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 text-sm transition ${
                    active
                      ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-cyan-300/30 hover:bg-cyan-500/10"
                  }`}
                >
                  <span>{item.label}</span>
                  {active ? <span className="h-2 w-2 rounded-full bg-cyan-300" /> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#04070b]/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                  >
                    <span aria-hidden="true">←</span>
                    Back
                  </button>
                  <Link href="/" className="lg:hidden">
                    <Image src="/assets/nightly-logo.png" alt="Nightly" width={95} height={26} className="h-7 w-auto" />
                  </Link>
                </div>
                <h1 className="mt-2 truncate text-lg font-semibold text-white sm:text-xl">{pageTitle}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-400">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    return (
                      <span key={crumb.href} className="flex items-center gap-1">
                        {isLast ? (
                          <span className="text-zinc-300">{crumb.label}</span>
                        ) : (
                          <Link href={crumb.href} className="transition hover:text-cyan-200">
                            {crumb.label}
                          </Link>
                        )}
                        {!isLast ? <span aria-hidden="true">/</span> : null}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-white/5 p-2 text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                  aria-label="Notifications placeholder"
                  title="Notifications (placeholder)"
                >
                  <PlaceholderIcon label="N" />
                </button>
                <Link
                  href="/profile"
                  className="rounded-full border border-white/20 bg-white/5 p-2 text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                  aria-label="Settings"
                  title="Settings"
                >
                  <PlaceholderIcon label="S" />
                </Link>
                {isSignedIn ? (
                  <div className="rounded-full border border-white/20 bg-white/5 p-0.5">
                    <UserButton />
                  </div>
                ) : (
                  <Link
                    href="/sign-in"
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 pb-24 lg:pb-6">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#04070b]/90 px-2 py-2 backdrop-blur-xl lg:hidden">
            <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 text-xs">
              {navItems.filter((item) => item.href).slice(0, 4).map((item) => {
                const active = item.href ? isCurrentPath(pathname, item.href) : false;

                return (
                  <Link
                    key={item.label}
                    href={item.href!}
                    className={`rounded-xl px-2 py-2 text-center transition ${
                      active ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-zinc-300 hover:bg-cyan-500/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}