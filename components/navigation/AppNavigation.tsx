"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import AppHeader from "@/components/navigation/AppHeader";
import NightlyLogoLink from "@/components/navigation/NightlyLogoLink";

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

type Breadcrumb = {
  label: string;
  href?: string;
};

type BottomNavItem = {
  label: string;
  href: string;
};

const roleFallbackByHistory: Record<Exclude<AppRole, null>, string> = {
  consumer: "/home",
  dj: "/dj/dashboard",
  owner: "/owner",
  admin: "/admin",
};

const roleItems: Record<Exclude<AppRole, null>, NavItem[]> = {
  consumer: [
    { label: "Home", href: "/home" },
    { label: "Explore", href: "/discover" },
    { label: "Concierge", href: "/concierge" },
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
    { label: "Edit Profile", href: "/dj/onboarding?edit=1" },
    { label: "Upload Mix", href: "/dj/mixes/new" },
    { label: "Manage Mixes", href: "/dj/mixes" },
    { label: "Public Profile", href: "/dj/profile" },
    { label: "Bookings", comingSoon: true },
    { label: "Analytics", comingSoon: true },
    { label: "Switch Account Type", href: "/select-role?changeRole=1" },
  ],
  owner: [
    { label: "Dashboard", href: "/owner" },
    { label: "Operations", href: "/owner/operations" },
    { label: "Staff", href: "/owner/staff" },
    { label: "Scheduling", href: "/owner/scheduling" },
    { label: "Floor", href: "/owner/floor" },
    { label: "VIP", href: "/owner/vip" },
    { label: "Inventory", href: "/owner/inventory" },
    { label: "CRM", href: "/owner/crm" },
    { label: "Marketing", href: "/owner/marketing" },
    { label: "Loyalty", href: "/owner/loyalty" },
    { label: "Reports", href: "/owner/reports" },
    { label: "Venue Profile", href: "/owner/venue" },
    { label: "Events", href: "/owner/events" },
    { label: "Gallery", href: "/owner/images" },
    { label: "Cameras", href: "/owner/cameras" },
    { label: "Analytics", comingSoon: true },
    { label: "Settings", href: "/owner/settings" },
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

const roleSecondaryFallback: Record<Exclude<AppRole, null>, string> = {
  consumer: "/discover",
  dj: "/dj/mixes",
  owner: "/owner/venue",
  admin: "/admin/analytics",
};

const hiddenPathPrefixes = ["/sign-in", "/sign-up", "/select-role", "/onboarding"];

function isCurrentPath(pathname: string, href: string) {
  if (href.includes("?")) {
    return pathname === href.split("?")[0];
  }

  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }

  if (href === "/owner") {
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
  if (pathname === "/concierge") return "AI Concierge";
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
  if (pathname === "/owner/operations") return "Operations";
  if (pathname === "/owner/staff") return "Staff";
  if (pathname === "/owner/scheduling") return "Scheduling";
  if (pathname === "/owner/floor") return "Floor";
  if (pathname === "/owner/tables") return "Tables";
  if (pathname === "/owner/vip") return "VIP";
  if (pathname === "/owner/inventory") return "Inventory";
  if (pathname === "/owner/crm") return "CRM";
  if (pathname === "/owner/marketing") return "Marketing";
  if (pathname === "/owner/loyalty") return "Loyalty";
  if (pathname === "/owner/reports") return "Reports";
  if (pathname === "/owner/events") return "Owner Events";
  if (pathname === "/owner/images") return "Owner Gallery";
  if (pathname === "/owner/cameras") return "Owner Cameras";
  if (pathname === "/owner/settings") return "Owner Settings";
  if (pathname === "/owner/hours") return "Business Hours";
  if (pathname === "/admin") return "Admin Dashboard";
  if (pathname === "/admin/analytics") return "Admin Analytics";
  if (pathname.startsWith("/venues/")) return "Venue Details";
  return segmentLabel(pathname.split("/").filter(Boolean).at(-1) ?? "Nightly");
}

function getUsefulBreadcrumbs(pathname: string): Breadcrumb[] {
  if (pathname === "/dj/mixes") {
    return [
      { label: "DJ Dashboard", href: "/dj/dashboard" },
      { label: "Manage Mixes" },
    ];
  }

  if (pathname === "/dj/mixes/new") {
    return [
      { label: "DJ Dashboard", href: "/dj/dashboard" },
      { label: "Manage Mixes", href: "/dj/mixes" },
      { label: "Upload Mix" },
    ];
  }

  if (pathname === "/owner/events") {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: "Events" },
    ];
  }

  if (pathname === "/owner/images") {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: "Gallery" },
    ];
  }

  if (pathname === "/owner/cameras") {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: "Cameras" },
    ];
  }

  if (pathname === "/owner/venue") {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: "Venue Profile" },
    ];
  }

  if (["/owner/operations", "/owner/staff", "/owner/scheduling", "/owner/floor", "/owner/tables", "/owner/vip", "/owner/inventory", "/owner/crm", "/owner/marketing", "/owner/loyalty", "/owner/reports"].includes(pathname)) {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: getPageTitle(pathname) },
    ];
  }

  if (pathname === "/owner/hours") {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: "Business Hours" },
    ];
  }

  if (pathname === "/owner/settings") {
    return [
      { label: "Owner Dashboard", href: "/owner" },
      { label: "Settings" },
    ];
  }

  return [];
}

function isConsumerHomePath(pathname: string) {
  return pathname === "/home";
}

function getBottomNavItems(role: Exclude<AppRole, null>): BottomNavItem[] {
  if (role === "consumer") {
    return [
      { label: "Home", href: "/home" },
      { label: "Explore", href: "/discover" },
      { label: "Concierge", href: "/concierge" },
      { label: "Profile", href: "/profile" },
    ];
  }

  return roleItems[role]
    .filter((item): item is NavItem & { href: string } => Boolean(item.href))
    .slice(0, 4)
    .map((item) => ({ label: item.label, href: item.href }));
}

function shouldShowBackButton(pathname: string) {
  return ![
    "/home",
    "/owner",
    "/owner/dashboard",
    "/dj/dashboard",
    "/admin",
    "/admin/analytics",
  ].includes(pathname);
}

function getBackFallback(role: Exclude<AppRole, null>, pathname: string, editMode: boolean) {
  if (pathname.startsWith("/dj/onboarding")) {
    return editMode ? "/dj/dashboard" : "/select-role?changeRole=1";
  }

  return roleFallbackByHistory[role];
}

export default function AppNavigation({ role, children }: AppNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSignedInUser = Boolean(isSignedIn);
  const isGuestDjPublicProfile = !isSignedInUser && /^\/dj\/profile\/[^/]+$/.test(pathname);
  const isGuestPublicEventRoute = !isSignedInUser && (pathname === "/events" || pathname.startsWith("/events/"));

  const shouldHide =
    pathname === "/" ||
    isGuestDjPublicProfile ||
    isGuestPublicEventRoute ||
    hiddenPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const activeRole: Exclude<AppRole, null> = role ?? "consumer";
  const isConsumerHome = isConsumerHomePath(pathname);
  const layoutRole: Exclude<AppRole, null> = isConsumerHome ? "consumer" : activeRole;
  const navItems = roleItems[layoutRole];
  const bottomNavItems = getBottomNavItems(layoutRole);
  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = useMemo(() => getUsefulBreadcrumbs(pathname), [pathname]);
  const editMode = searchParams.get("edit") === "1";
  const showBackButton = shouldShowBackButton(pathname);

  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const fallback = getBackFallback(activeRole, pathname, editMode);
    const fallbackPath = fallback.split("?")[0];

    if (fallbackPath === pathname) {
      const secondary = roleSecondaryFallback[activeRole];

      if (secondary !== pathname) {
        router.push(secondary);
        return;
      }

      router.push("/");
      return;
    }

    router.push(fallback);
  };

  if (shouldHide) {
    return <div className="nightly-route-transition">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {!isConsumerHome ? (
          <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/10 bg-zinc-950/70 px-4 py-6 backdrop-blur-xl lg:block">
            <NightlyLogoLink role={activeRole} width={120} height={34} imageClassName="h-9 w-auto" priority />

            <div className="mt-6 px-2">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{layoutRole} navigation</p>
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
                          Coming Soon
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
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            activeRole={activeRole}
            pageTitle={pageTitle}
            breadcrumbs={breadcrumbs}
            mobileMenuOpen={mobileMenuOpen}
            onToggleMobileMenu={() => setMobileMenuOpen((value) => !value)}
            onBack={onBack}
            showBackButton={showBackButton}
            isSignedIn={isSignedInUser}
            alwaysShowLogo={isConsumerHome}
          />

          {mobileMenuOpen ? (
            <div className="border-b border-white/10 bg-[#04070b]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
              <nav className="grid gap-2">
                {navItems.map((item) => {
                  const active = item.href ? isCurrentPath(pathname, item.href) : false;

                  if (item.comingSoon || !item.href) {
                    return (
                      <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
                        <span>{item.label}</span>
                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                          Coming Soon
                        </span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`rounded-xl border px-4 py-3 text-sm transition ${
                        active
                          ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                          : "border-white/10 bg-white/[0.04] text-zinc-100 hover:border-cyan-300/30 hover:bg-cyan-500/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}

          <main className="nightly-route-transition min-h-0 flex-1 pb-24 lg:pb-6">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#04070b]/90 px-2 py-2 backdrop-blur-xl lg:hidden">
            <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 text-xs">
              {bottomNavItems.map((item) => {
                const active = isCurrentPath(pathname, item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
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