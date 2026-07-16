import { Entity, PolylineGraphics } from "resium";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ArcType,
  DistanceDisplayCondition,
} from "cesium";
import type { FlightVector, FlightRoute } from "@/types/domain";

interface FlightPredictLayerProps {
  flight: FlightVector | null;
  route?: FlightRoute | null;
  minutes?: number;
}

const PREDICT_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.45);
const PATH_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.2);
const NEAR_FAR = { near: 0, far: 10_000_000 } as const;

function projectFlight(
  lon: number,
  lat: number,
  alt: number,
  headingDeg: number,
  velocityMs: number,
  seconds: number,
): { lon: number; lat: number; alt: number; points: number[] } {
  const earthR = 6371000;
  const angularHeading = (headingDeg * Math.PI) / 180;
  const dist = velocityMs * seconds;
  const cosLat = Math.cos((lat * Math.PI) / 180);

  const dLat = (dist * Math.cos(angularHeading)) / earthR;
  const dLon = (dist * Math.sin(angularHeading)) / (earthR * Math.max(0.01, cosLat));

  const steps = 12;
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(
      lon + (dLon * t * 180) / Math.PI,
      lat + (dLat * t * 180) / Math.PI,
      alt,
    );
  }

  return {
    lon: lon + (dLon * 180) / Math.PI,
    lat: lat + (dLat * 180) / Math.PI,
    alt,
    points,
  };
}

function buildGreatCirclePoints(
  lon1: number,
  lat1: number,
  alt1: number,
  lon2: number,
  lat2: number,
  alt2: number,
  segments: number = 48,
): number[] {
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = lat1 + (lat2 - lat1) * t;
    const lon = lon1 + (lon2 - lon1) * t;
    const alt = alt1 + (alt2 - alt1) * t;
    points.push(lon, lat, alt);
  }
  return points;
}

export function FlightPredictLayer({
  flight,
  route,
  minutes = 15,
}: FlightPredictLayerProps) {
  if (!flight || flight.heading == null || flight.velocity == null) return null;

  const alt = flight.baro_altitude ?? 10000;
  const entities: React.ReactNode[] = [];

  const projected = projectFlight(
    flight.longitude,
    flight.latitude,
    alt,
    flight.heading,
    flight.velocity,
    minutes * 60,
  );

  entities.push(
    <Entity key="predict-arc" name={`predict-${flight.icao24}`}>
      <PolylineGraphics
        positions={Cartesian3.fromDegreesArrayHeights(projected.points)}
        width={2}
        material={new ColorMaterialProperty(PREDICT_COLOR)}
        arcType={ArcType.NONE}
        distanceDisplayCondition={new DistanceDisplayCondition(
          NEAR_FAR.near,
          NEAR_FAR.far,
        )}
      />
    </Entity>,
  );

  const arr = route?.arrival_airport;
  if (arr) {
    const pathCoords = buildGreatCirclePoints(
      projected.lon,
      projected.lat,
      projected.alt,
      arr.longitude,
      arr.latitude,
      alt,
      64,
    );

    entities.push(
      <Entity key="predict-path" name={`predict-path-${flight.icao24}`}>
        <PolylineGraphics
          positions={Cartesian3.fromDegreesArrayHeights(pathCoords)}
          width={1.2}
          material={new ColorMaterialProperty(PATH_COLOR)}
          arcType={ArcType.NONE}
          distanceDisplayCondition={new DistanceDisplayCondition(
            NEAR_FAR.near,
            NEAR_FAR.far,
          )}
        />
      </Entity>,
    );
  }

  const dep = route?.departure_airport;
  if (dep && flight) {
    const traveledCoords = buildGreatCirclePoints(
      dep.longitude,
      dep.latitude,
      alt,
      flight.longitude,
      flight.latitude,
      alt,
      32,
    );

    entities.push(
      <Entity key="predict-traveled" name={`predict-traveled-${flight.icao24}`}>
        <PolylineGraphics
          positions={Cartesian3.fromDegreesArrayHeights(traveledCoords)}
          width={1.2}
          material={new ColorMaterialProperty(PATH_COLOR)}
          arcType={ArcType.NONE}
          distanceDisplayCondition={new DistanceDisplayCondition(
            NEAR_FAR.near,
            NEAR_FAR.far,
          )}
        />
      </Entity>,
    );
  }

  return <>{entities}</>;
}
