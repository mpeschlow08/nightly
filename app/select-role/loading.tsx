import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function SelectRoleLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Role"
      title="Loading account roles"
      subtitle="Checking available role experiences for your profile."
      metricCount={2}
      cardCount={3}
      listCount={3}
    />
  );
}