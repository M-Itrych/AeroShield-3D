import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onSearchFocus: () => void;
  onDeselect: () => void;
  onToggleFollow: () => void;
  onResetView: () => void;
  onToggleAutoRotate: () => void;
  hasSelectedFlight: boolean;
}

export function useKeyboardShortcuts({
  onSearchFocus,
  onDeselect,
  onToggleFollow,
  onResetView,
  onToggleAutoRotate,
  hasSelectedFlight,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      switch (e.key) {
        case "/":
          e.preventDefault();
          onSearchFocus();
          break;
        case "Escape":
          onDeselect();
          break;
        case "f":
        case "F":
          if (hasSelectedFlight) {
            e.preventDefault();
            onToggleFollow();
          }
          break;
        case "r":
        case "R":
          e.preventDefault();
          onResetView();
          break;
        case " ":
          e.preventDefault();
          onToggleAutoRotate();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onSearchFocus,
    onDeselect,
    onToggleFollow,
    onResetView,
    onToggleAutoRotate,
    hasSelectedFlight,
  ]);
}
