import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";

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
    <NightlySectionHeader title={title} href={href} actionLabel={actionLabel} />
  );
}
