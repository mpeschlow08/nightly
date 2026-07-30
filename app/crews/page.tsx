import LinkUpClient from "@/components/linkup/LinkUpClient";

type Props = {
  searchParams: Promise<{ venue?: string } | undefined>;
};

export default async function CrewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedVenue = params?.venue ? decodeURIComponent(params.venue) : undefined;

  return <LinkUpClient selectedVenue={selectedVenue} />;
}
