import { useEffect } from "react";
import {
  Cartesian3,
  Matrix4,
  type Viewer as CesiumViewer,
  Math as CesiumMath,
} from "cesium";
import type { FlightVector } from "@/types/domain";

interface UseFollowFlightOptions {
  viewer: CesiumViewer | null;
  selectedFlight: FlightVector | null;
  enabled: boolean;
}

export function useFollowFlight({
  viewer,
  selectedFlight,
  enabled,
}: UseFollowFlightOptions) {
  useEffect(() => {
    if (!viewer || !enabled || !selectedFlight) return;

    let raf: number;
    const flight = selectedFlight;
    let lastLon = flight.longitude;
    let lastLat = flight.latitude;

    const alt = flight.baro_altitude ?? 10000;
    viewer.camera.lookAt(
      Cartesian3.fromDegrees(flight.longitude, flight.latitude, alt),
      new Cartesian3(0, 0, 8000),
    );

    const update = () => {
      if (
        Math.abs(flight.longitude - lastLon) > 0.0005 ||
        Math.abs(flight.latitude - lastLat) > 0.0005
      ) {
        lastLon = flight.longitude;
        lastLat = flight.latitude;
        const a = flight.baro_altitude ?? 10000;
        viewer.camera.lookAt(
          Cartesian3.fromDegrees(flight.longitude, flight.latitude, a),
          new Cartesian3(0, 0, 8000),
        );
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    };
  }, [viewer, selectedFlight, enabled]);
}

export function focusFlight(
  viewer: CesiumViewer | null,
  flight: FlightVector,
) {
  if (!viewer) return;
  const alt = flight.baro_altitude ?? 10000;
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      flight.longitude,
      flight.latitude,
      alt + 8000,
    ),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-90),
      roll: 0,
    },
    duration: 1.0,
  });
}
