import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div className="starfield-bg relative h-screen w-screen overflow-hidden">
      <Outlet />
    </div>
  ),
});
