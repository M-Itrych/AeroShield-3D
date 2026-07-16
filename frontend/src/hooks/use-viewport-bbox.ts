import { useEffect, useState } from "react";
import { Math as CesiumMath, type Viewer as CesiumViewer, type Rectangle } from "cesium";

export interface BboxParams {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}

const WORLD_BBOX: BboxParams = {
  lamin: -90,
  lamax: 90,
  lomin: -180,
  lomax: 180,
};

function rectToBbox(rect: Rectangle): BboxParams {
  return {
    lamin: CesiumMath.toDegrees(rect.south),
    lamax: CesiumMath.toDegrees(rect.north),
    lomin: CesiumMath.toDegrees(rect.west),
    lomax: CesiumMath.toDegrees(rect.east),
  };
}

export function useViewportBbox(viewer: CesiumViewer | null): BboxParams {
  const [bbox, setBbox] = useState<BboxParams>(WORLD_BBOX);

  useEffect(() => {
    if (!viewer) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 600;
    const MIN_DELTA = 0.5;

    let lastBbox: BboxParams = WORLD_BBOX;

    const update = () => {
      const rect = viewer.camera.computeViewRectangle();
      if (!rect) return;
      const next = rectToBbox(rect);
      const movedEnough =
        Math.abs(next.lamin - lastBbox.lamin) > MIN_DELTA ||
        Math.abs(next.lamax - lastBbox.lamax) > MIN_DELTA ||
        Math.abs(next.lomin - lastBbox.lomin) > MIN_DELTA ||
        Math.abs(next.lomax - lastBbox.lomax) > MIN_DELTA;
      if (!movedEnough) return;
      lastBbox = next;
      setBbox(next);
    };

    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, DEBOUNCE_MS);
    };

    const remove = viewer.camera.changed.addEventListener(handler);
    return () => {
      remove();
      if (timer) clearTimeout(timer);
    };
  }, [viewer]);

  return bbox;
}
