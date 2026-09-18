import type { ButtonHTMLAttributes, ReactNode } from "react";

type NightlyIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
};

export default function NightlyIconButton({
  icon,
  label,
  className,
  type,
  ...rest
}: NightlyIconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={`nightly-btn-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-black/45 text-sm text-[color:var(--text-primary)] backdrop-blur ${className ?? ""}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
