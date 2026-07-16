import { Entity, PolylineGraphics } from "resium";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ArcType,
  DistanceDisplayCondition,
} from "cesium";
import type { FlightVector } from "@/types/domain";

interface FlightPredictLayerProps {
  flight: FlightVector | null;
  minutes?: number;
}

const PREDICT_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.3);
const PREDICT_NEAR_FAR = { near: 0, far: 8_000_000 } as const;

function projectFlight(
  lon: number,
  lat: number,
  alt: number,
  headingDeg: number,
  velocityMs: number,
  seconds: number,
): number[] {
  const earthR = 6371000;
  const angularHeading = (headingDeg * Math.PI) / 180;
  const dist = velocityMs * seconds;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLat = (dist * Math.cos(angularHeading)) / earthR;
  const dLon = (dist * Math.sin(angularHeading)) / (earthR * Math.max(0.01, cosLat));

  const steps = 8;
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(
      lon + (dLon * t * 180) / Math.PI,
      lat + (dLat * t * 180) / Math.PI,
      alt,
    );
  }
  return points;
}

export function FlightPredictLayer({
  flight,
  minutes = 15,
}: FlightPredictLayerProps) {
  if (!flight || flight.heading == null || flight.velocity == null) return null;

  const alt = flight.baro_altitude ?? 10000;
  const coords = projectFlight(
    flight.longitude,
    flight.latitude,
    alt,
    flight.heading,
    flight.velocity,
    minutes * 60,
  );

  return (
    <Entity name={`predict-${flight.icao24}`}>
      <PolylineGraphics
        positions={Cartesian3.fromDegreesArrayHeights(coords)}
        width={1.5}
        material={new ColorMaterialProperty(PREDICT_COLOR)}
        arcType={ArcType.NONE}
        distanceDisplayCondition={new DistanceDisplayCondition(
          PREDICT_NEAR_FAR.near,
          PREDICT_NEAR_FAR.far,
        )}
      />
    </Entity>
  );
}
