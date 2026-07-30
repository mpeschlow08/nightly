"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import NightlyLogoLink from "@/components/navigation/NightlyLogoLink";

type AppRole = "consumer" | "dj" | "owner" | "admin";

type Breadcrumb = {
  label: string;
  href?: string;
};

type AppHeaderProps = {
  activeRole: AppRole;
  pageTitle: string;
  breadcrumbs: Breadcrumb[];
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onBack: () => void;
  showBackButton: boolean;
  isSignedIn: boolean;
  alwaysShowLogo?: boolean;
};

function PlaceholderIcon({ label }: { label: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-zinc-300"
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="nightly-btn-secondary inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100"
    >
      <span aria-hidden="true">←</span>
      Back
    </button>
  );
}

export default function AppHeader({
  activeRole,
  pageTitle,
  breadcrumbs,
  mobileMenuOpen,
  onToggleMobileMenu,
  onBack,
  showBackButton,
  isSignedIn,
  alwaysShowLogo = false,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#04070b]/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {showBackButton ? <BackButton onBack={onBack} /> : null}
            {!alwaysShowLogo ? (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="nightly-btn-secondary inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle mobile navigation menu"
              >
                Menu
              </button>
            ) : null}
            <NightlyLogoLink
              role={activeRole}
              width={95}
              height={26}
              imageClassName="h-7 w-auto"
              className={alwaysShowLogo ? "" : "lg:hidden"}
            />
          </div>
          <h1 className="mt-2 truncate text-lg font-semibold text-white sm:text-xl">{pageTitle}</h1>
          {breadcrumbs.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-400">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;

                return (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href} className="transition hover:text-cyan-200">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-zinc-300">{crumb.label}</span>
                    )}
                    {!isLast ? <span aria-hidden="true">/</span> : null}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!alwaysShowLogo ? (
            <button
              type="button"
              className="nightly-btn-secondary rounded-full border border-white/20 bg-white/5 p-2 text-zinc-200"
              aria-label="Notifications placeholder"
              title="Notifications (placeholder)"
            >
              <PlaceholderIcon label="N" />
            </button>
          ) : null}
          {!alwaysShowLogo ? (
            <Link
              href="/profile"
              className="nightly-btn-secondary rounded-full border border-white/20 bg-white/5 p-2 text-zinc-200"
              aria-label="Settings"
              title="Settings"
            >
              <PlaceholderIcon label="S" />
            </Link>
          ) : null}
          {isSignedIn ? (
            <div className="rounded-full border border-white/20 bg-white/5 p-0.5">
              <UserButton />
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="nightly-btn-secondary rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-200"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
