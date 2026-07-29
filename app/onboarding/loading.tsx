import { RouteLoadingShell } from "@/components/navigation/RouteLoadingShell";

export default function OnboardingLoading() {
  return (
    <RouteLoadingShell
      eyebrow="Onboarding"
      title="Setting up your access"
      subtitle="Preparing role selection and account setup steps."
      metricCount={2}
      cardCount={3}
      listCount={4}
    />
  );
}