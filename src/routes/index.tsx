import { createFileRoute } from "@tanstack/react-router";
import { FirstNight } from "@/components/FirstNight";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FirstNight />;
}
