import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";

type VenueSectionHeadingProps = {
  title: string;
  href?: string;
  actionLabel?: string;
};

export default function VenueSectionHeading({
  title,
  href,
  actionLabel = "See All",
}: VenueSectionHeadingProps) {
  return <NightlySectionHeader title={title} href={href} actionLabel={actionLabel} />;
}
