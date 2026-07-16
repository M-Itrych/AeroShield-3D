import { Math as CesiumMath, type Viewer as CesiumViewer, Rectangle } from "cesium";
import type { HazardPolygon } from "@/types/domain";

const DEFAULT_VIEW = Rectangle.fromDegrees(-180, -85, 180, 85);

export function resetView(viewer: CesiumViewer | null) {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: DEFAULT_VIEW,
    orientation: {
      heading: 0,
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    },
    duration: 1.5,
  });
}

export function focusSigmet(viewer: CesiumViewer | null, sigmet: HazardPolygon) {
  if (!viewer || sigmet.points.length === 0) return;

  const lons = sigmet.points.map((p) => p[0]);
  const lats = sigmet.points.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const padding = 2;

  viewer.camera.flyTo({
    destination: Rectangle.fromDegrees(
      minLon - padding,
      minLat - padding,
      maxLon + padding,
      maxLat + padding,
    ),
    duration: 1.2,
  });
}

export { DEFAULT_VIEW };
