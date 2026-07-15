import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/airport/$icao")({
  component: () => <div>Airport detail placeholder</div>,
});
