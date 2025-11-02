import { createFileRoute } from "@tanstack/react-router";
import { Timeline } from "@/components/Timeline";

function HomePage() {
  return <Timeline />;
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
