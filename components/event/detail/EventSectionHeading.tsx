import NightlySectionHeader from "@/components/nightly/NightlySectionHeader";

type EventSectionHeadingProps = {
  title: string;
  href?: string;
  actionLabel?: string;
};

export default function EventSectionHeading({
  title,
  href,
  actionLabel = "See All",
}: EventSectionHeadingProps) {
  return <NightlySectionHeader title={title} href={href} actionLabel={actionLabel} />;
}
