import { useEffect } from "react";
import { type Viewer as CesiumViewer, Math as CesiumMath } from "cesium";

interface UseAutoRotateOptions {
  viewer: CesiumViewer | null;
  enabled: boolean;
}

const ROTATE_SPEED = 0.05;

export function useAutoRotate({ viewer, enabled }: UseAutoRotateOptions) {
  useEffect(() => {
    if (!viewer || !enabled) return;

    let raf: number;

    const spin = () => {
      const camera = viewer.camera;
      const currentHeading = camera.heading;
      camera.setView({
        orientation: {
          heading: currentHeading + CesiumMath.toRadians(ROTATE_SPEED),
          pitch: camera.pitch,
          roll: camera.roll,
        },
      });
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);

    return () => cancelAnimationFrame(raf);
  }, [viewer, enabled]);
}
