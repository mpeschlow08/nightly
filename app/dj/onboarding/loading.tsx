import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function DjOnboardingLoading() {
  return (
    <RouteLoadingShell
      eyebrow="DJ Onboarding"
      title="Loading profile setup"
      subtitle="Preparing your public identity and booking settings."
      metricCount={2}
      cardCount={4}
      listCount={4}
    />
  );
}