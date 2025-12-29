import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Timeline } from "@/components/Timeline";
import { useEffect } from "react";

function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding") === "true";
    if (!hasSeenOnboarding) {
      navigate({ to: "/onboarding" });
    }
  }, [navigate]);

  return <Timeline />;
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
