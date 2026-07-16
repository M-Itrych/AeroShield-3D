import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div className="relative h-screen w-screen overflow-hidden bg-radar-bg">
      <Outlet />
    </div>
  ),
});
