import { useEffect } from "react";
import {
  type Viewer as CesiumViewer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  type Cartesian2,
} from "cesium";

interface UseGlobeClickOptions {
  viewer: CesiumViewer | null;
  onPickFlight: (icao24: string) => void;
  onPickSigmet: (sigmetId: string) => void;
  onBackgroundClick: () => void;
}

const KNOWN_PREFIXES = ["APT-", "trail-", "route-", "SIGMET", "Entity"];

function isFlightId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  if (KNOWN_PREFIXES.some((p) => id.startsWith(p))) return false;
  return /^[0-9a-fA-F]{6}$/.test(id) || id.length <= 12;
}

export function useGlobeClick({
  viewer,
  onPickFlight,
  onPickSigmet,
  onBackgroundClick,
}: UseGlobeClickOptions) {
  useEffect(() => {
    if (!viewer) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.position);
      if (!defined(picked)) {
        onBackgroundClick();
        return;
      }

      let id: string = "";
      if (picked.id && typeof picked.id === "object") {
        const entity = picked.id;
        const name = entity.name?.getValue?.() ?? entity.name;
        id = typeof entity.id === "string" ? entity.id : "";

        if (typeof name === "string") {
          if (name.startsWith("trail-")) {
            const icao24 = name.replace("trail-", "").replace("trail-origin-", "").replace("trail-head-", "").replace("trail-origin-core-", "");
            if (icao24) onPickFlight(icao24);
            return;
          }
          if (name.startsWith("route-")) {
            const icao24 = name.replace("route-", "");
            if (icao24) onPickFlight(icao24);
            return;
          }
          if (name.startsWith("SIGMET ")) {
            const sigId = name.replace("SIGMET ", "").split(" ")[0];
            if (sigId) onPickSigmet(sigId);
            return;
          }
        }
      }

      const prim = picked.primitive;
      if (prim && typeof prim.id === "string") {
        id = prim.id;
      }

      if (isFlightId(id)) {
        onPickFlight(id);
        return;
      }
      if (id.startsWith("APT-")) return;

      onBackgroundClick();
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, [viewer, onPickFlight, onPickSigmet, onBackgroundClick]);
}
