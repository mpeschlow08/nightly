import Link from "next/link";

type ExploreSectionHeaderProps = {
  title: string;
  href?: string;
  actionLabel?: string;
};

export default function ExploreSectionHeader({
  title,
  href,
  actionLabel = "See All",
}: ExploreSectionHeaderProps) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
