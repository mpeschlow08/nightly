import Image from "next/image";

type NightlyAvatarProps = {
  label: string;
  imageUrl?: string | null;
  size?: "sm" | "md";
};

export default function NightlyAvatar({ label, imageUrl, size = "md" }: NightlyAvatarProps) {
  const initials = label
    .split(" ")
    .map((item) => item.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClassName = size === "sm" ? "h-7 w-7 text-[0.62rem]" : "h-9 w-9 text-xs";

  if (imageUrl) {
    return (
      <span className={`relative inline-flex overflow-hidden rounded-full border border-[color:var(--border)] ${sizeClassName}`}>
        <Image src={imageUrl} alt={label} fill sizes={size === "sm" ? "28px" : "36px"} className="object-cover" />
      </span>
    );
  }

  return (
    <span className={`${sizeClassName} inline-flex items-center justify-center rounded-full border border-[color:var(--border)] bg-white/5 font-semibold text-[color:var(--text-secondary)]`} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}
