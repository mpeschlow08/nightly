"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

type AppRole = "consumer" | "dj" | "owner" | "admin";

type NightlyLogoLinkProps = {
  role?: AppRole | null;
  width?: number;
  height?: number;
  imageClassName?: string;
  className?: string;
  priority?: boolean;
};

const roleHomeHref: Record<AppRole, string> = {
  consumer: "/home",
  owner: "/owner",
  dj: "/dj/dashboard",
  admin: "/admin",
};

function getRoleFromPathname(pathname: string): AppRole {
  if (pathname.startsWith("/owner")) {
    return "owner";
  }

  if (pathname.startsWith("/dj")) {
    return "dj";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  return "consumer";
}

export default function NightlyLogoLink({
  role,
  width = 120,
  height = 34,
  imageClassName = "h-9 w-auto",
  className,
  priority = false,
}: NightlyLogoLinkProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  const activeRole = role ?? getRoleFromPathname(pathname);
  const href = isSignedIn ? roleHomeHref[activeRole] : "/";

  return (
    <Link
      href={href}
      aria-label="Go to your Nightly home"
      className={`inline-flex cursor-pointer items-center rounded-2xl px-2 py-2 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/5 hover:drop-shadow-[0_0_14px_rgba(74,222,255,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${className ?? ""}`}
    >
      <Image
        src="/assets/nightly-logo.png"
        alt="Nightly"
        width={width}
        height={height}
        className={imageClassName}
        priority={priority}
      />
    </Link>
  );
}
