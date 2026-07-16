import { Outlet, createRootRoute, redirect } from "@tanstack/react-router";

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/" && isMobileViewport()) {
      throw redirect({ to: "/m" });
    }
    if (location.pathname === "/m" && !isMobileViewport()) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <div className="starfield-bg relative h-screen w-screen overflow-hidden">
      <Outlet />
    </div>
  ),
});
