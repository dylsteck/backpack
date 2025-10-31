import { createFileRoute } from "@tanstack/react-router";
import iconImage from "@/assets/images/icon.png";

function HomePage() {
  return (
    <div className="flex h-full items-center justify-center">
      <img src={iconImage} alt="Cortex" className="h-24 w-24" />
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
