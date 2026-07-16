import { Entity, PolylineGraphics } from "resium";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ArcType,
  DistanceDisplayCondition,
} from "cesium";
import { useMemo } from "react";
import type { FlightVector, FlightRoute } from "@/types/domain";

interface FlightPredictLayerProps {
  flight: FlightVector | null;
  route?: FlightRoute | null;
  minutes?: number;
}

const NEAR_FAR = { near: 0, far: 60_000_000 } as const;
const EARTH_R = 6371000;

const COLOR_LOW = Color.fromCssColorString("#5a6770").withAlpha(0.6);
const COLOR_MID = Color.fromCssColorString("#39ff14").withAlpha(0.5);
const COLOR_HIGH = Color.fromCssColorString("#ff5f1f").withAlpha(0.55);
const COLOR_CRUISE = Color.fromCssColorString("#ff5f1f").withAlpha(0.7);

function altitudeColor(altFt: number): Color {
  if (altFt < 10000) return COLOR_LOW;
  if (altFt < 25000) return COLOR_MID;
  if (altFt < 40000) return COLOR_HIGH;
  return COLOR_CRUISE;
}

function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a)) / 1000;
}

function projectFlight(
  lon: number,
  lat: number,
  alt: number,
  headingDeg: number,
  velocityMs: number,
  seconds: number,
): { lon: number; lat: number; alt: number; points: PathPoint[] } {
  const angularHeading = (headingDeg * Math.PI) / 180;
  const dist = velocityMs * seconds;
  const cosLat = Math.cos((lat * Math.PI) / 180);

  const dLat = (dist * Math.cos(angularHeading)) / EARTH_R;
  const dLon = (dist * Math.sin(angularHeading)) / (EARTH_R * Math.max(0.01, cosLat));

  const steps = 12;
  const points: PathPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lon: lon + (dLon * t * 180) / Math.PI,
      lat: lat + (dLat * t * 180) / Math.PI,
      altM: alt,
    });
  }

  return {
    lon: lon + (dLon * 180) / Math.PI,
    lat: lat + (dLat * 180) / Math.PI,
    alt,
    points,
  };
}

interface PathPoint {
  lon: number;
  lat: number;
  altM: number;
}

function buildPathToAirport(
  startLon: number,
  startLat: number,
  startAltM: number,
  arrLon: number,
  arrLat: number,
  segments: number = 64,
): PathPoint[] {
  const totalDistKm = haversineKm(startLon, startLat, arrLon, arrLat);
  const cruiseAltM = startAltM;
  const descentStartFraction = totalDistKm > 300 ? 0.7 : 0.5;

  const points: PathPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = startLat + (arrLat - startLat) * t;
    const lon = startLon + (arrLon - startLon) * t;

    let altM: number;
    if (t < descentStartFraction) {
      altM = cruiseAltM;
    } else {
      const descentT = (t - descentStartFraction) / (1 - descentStartFraction);
      altM = cruiseAltM * (1 - descentT);
    }

    points.push({ lon, lat, altM: Math.max(0, altM) });
  }
  return points;
}

function buildColoredSegments(
  points: PathPoint[],
  prefix: string,
  icao24: string,
  width: number,
): React.ReactNode[] {
  const segments: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midAltFt = ((p1.altM + p2.altM) / 2) * 3.28084;
    const color = altitudeColor(midAltFt);

    segments.push(
      <Entity key={`${prefix}-${icao24}-${i}`} name={`predict-${icao24}`}>
        <PolylineGraphics
          positions={Cartesian3.fromDegreesArrayHeights([
            p1.lon,
            p1.lat,
            p1.altM,
            p2.lon,
            p2.lat,
            p2.altM,
          ])}
          width={width}
          material={new ColorMaterialProperty(color)}
          arcType={ArcType.NONE}
          distanceDisplayCondition={new DistanceDisplayCondition(
            NEAR_FAR.near,
            NEAR_FAR.far,
          )}
        />
      </Entity>,
    );
  }
  return segments;
}

export function FlightPredictLayer({
  flight,
  route,
  minutes = 15,
}: FlightPredictLayerProps) {
  const entities = useMemo(() => {
    if (!flight || flight.heading == null || flight.velocity == null) return [];

    const altM = flight.baro_altitude ?? 10000;
    const icao24 = flight.icao24;
    const out: React.ReactNode[] = [];

    const projected = projectFlight(
      flight.longitude,
      flight.latitude,
      altM,
      flight.heading,
      flight.velocity,
      minutes * 60,
    );

    out.push(...buildColoredSegments(projected.points, "predict-arc", icao24, 2));

    const arr = route?.arrival_airport;
    if (arr) {
      const toAirportPath = buildPathToAirport(
        projected.lon,
        projected.lat,
        projected.alt,
        arr.longitude,
        arr.latitude,
        24,
      );

      out.push(
        ...buildColoredSegments(toAirportPath, "predict-path", icao24, 1.5),
      );
    }

    const dep = route?.departure_airport;
    if (dep) {
      const traveledPoints = buildPathToAirport(
        flight.longitude,
        flight.latitude,
        altM,
        dep.longitude,
        dep.latitude,
        12,
      ).reverse();

      for (let i = 0; i < traveledPoints.length; i++) {
        const t = i / Math.max(1, traveledPoints.length - 1);
        traveledPoints[i].altM = altM * Math.min(1, t * 1.5);
      }

      out.push(
        ...buildColoredSegments(traveledPoints, "predict-traveled", icao24, 1.2),
      );
    }

    return out;
  }, [flight, route, minutes]);

  if (entities.length === 0) return null;
  return <>{entities}</>;
}
