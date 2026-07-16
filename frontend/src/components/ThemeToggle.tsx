import { useCallback, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const next: Theme = theme === "dark" ? "light" : "dark";

      // Circular reveal wipe from the click point (view-transition API).
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => {
          finished: Promise<void>;
        };
      };
      const setThemeNow = () => setTheme(next);

      if (!doc.startViewTransition) {
        setThemeNow();
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const maxR = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      const root = document.documentElement;
      root.style.setProperty("--theme-x", `${x}px`);
      root.style.setProperty("--theme-y", `${y}px`);
      root.style.setProperty("--theme-r", `${maxR}px`);

      const transition = doc.startViewTransition(setThemeNow);
      transition.finished.finally(() => {
        root.style.removeProperty("--theme-x");
        root.style.removeProperty("--theme-y");
        root.style.removeProperty("--theme-r");
      });
    },
    [theme],
  );

  const toDark = theme === "light";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${toDark ? "dark" : "light"} mode`}
      className="relative flex size-7 items-center justify-center border border-hud-border bg-hud-charcoal/60 text-hud-dim transition-colors hover:text-hud-grid active:scale-[0.96]"
    >
      {/* Cross-fade: both icons stay in DOM, absolutely stacked. */}
      <Sun
        className={`absolute size-3.5 transition-all duration-200 ${
          toDark
            ? "scale-100 opacity-100 rotate-0"
            : "scale-50 opacity-0 rotate-90"
        }`}
        style={{ transitionTimingFunction: toDark ? "cubic-bezier(0.2,0,0,1)" : "cubic-bezier(0.4,0,1,1)" }}
      />
      <Moon
        className={`absolute size-3.5 transition-all duration-200 ${
          toDark
            ? "scale-50 opacity-0 -rotate-90"
            : "scale-100 opacity-100 rotate-0"
        }`}
        style={{ transitionTimingFunction: toDark ? "cubic-bezier(0.4,0,1,1)" : "cubic-bezier(0.2,0,0,1)" }}
      />
    </button>
  );
}
