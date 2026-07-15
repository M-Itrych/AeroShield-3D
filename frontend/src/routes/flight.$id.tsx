import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/flight/$id")({
  component: () => <div>Flight detail placeholder</div>,
});
