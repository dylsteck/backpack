import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

function OnboardingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has already seen onboarding
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding") === "true";
    if (hasSeenOnboarding) {
      navigate({ to: "/" });
    }
  }, [navigate]);

  return (
    <div className="flex h-screen w-full bg-background">
      <OnboardingFlow />
    </div>
  );
}

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

