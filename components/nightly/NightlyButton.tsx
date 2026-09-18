import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type NightlyButtonVariant = "primary" | "secondary" | "ghost";

type SharedProps = {
  children: ReactNode;
  variant?: NightlyButtonVariant;
  className?: string;
};

type NightlyButtonAsButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type NightlyButtonAsLinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "type"> & {
    href: string;
  };

function isLinkProps(
  props: NightlyButtonAsButtonProps | NightlyButtonAsLinkProps
): props is NightlyButtonAsLinkProps {
  return typeof (props as NightlyButtonAsLinkProps).href === "string";
}

function variantClassName(variant: NightlyButtonVariant) {
  if (variant === "primary") {
    return "nightly-btn-primary border-transparent bg-gradient-to-r from-sky-400 to-violet-500 text-white hover:from-sky-300 hover:to-violet-400";
  }

  if (variant === "ghost") {
    return "nightly-btn-secondary border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-white/6";
  }

  return "nightly-btn-secondary border-[color:var(--border)] bg-white/[0.03] text-[color:var(--text-secondary)]";
}

export default function NightlyButton(props: NightlyButtonAsButtonProps | NightlyButtonAsLinkProps) {
  if (isLinkProps(props)) {
    const { children, variant = "secondary", className, href, ...linkRest } = props;
    const classes = `inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium tracking-[0.01em] transition ${variantClassName(variant)} ${className ?? ""}`;

    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const { children, variant = "secondary", className, ...buttonRest } = props;
  const classes = `inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium tracking-[0.01em] transition ${variantClassName(variant)} ${className ?? ""}`;

  return (
    <button type="button" className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
