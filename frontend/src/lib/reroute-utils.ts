import type { FlightVector, HazardPolygon, FlightRoute } from "@/types/domain";

const EARTH_R_M = 6_371_000;
const NM_TO_M = 1852;
const FT_TO_M = 0.3048;

export interface RerouteOption {
  id: string;
  side: "LEFT" | "RIGHT";
  offset_nm: number;
  waypoints: { lon: number; lat: number; alt_m: number }[];
  extra_km: number;
  extra_min: number;
}

export function haversineKm(
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
  return (2 * EARTH_R_M * Math.asin(Math.sqrt(a))) / 1000;
}

function destinationPoint(
  lon: number,
  lat: number,
  bearingDeg: number,
  distM: number,
): { lon: number; lat: number } {
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const brng = (bearingDeg * Math.PI) / 180;
  const d = distM / EARTH_R_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lon: ((lon2 * 180) / Math.PI + 540) % 360 - 180,
    lat: (lat2 * 180) / Math.PI,
  };
}

function polygonCentroid(points: [number, number][]): { lon: number; lat: number } {
  let lon = 0;
  let lat = 0;
  for (const [px, py] of points) {
    lon += px;
    lat += py;
  }
  return { lon: lon / points.length, lat: lat / points.length };
}

function bearingDeg(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function computeRerouteOptions(
  flight: FlightVector,
  route: FlightRoute | null,
  sigmets: HazardPolygon[],
  riskSigmetId: string | null,
): RerouteOption[] {
  if (!route?.arrival_airport) return [];
  const sig = sigmets.find((s) => s.sigmet_id === riskSigmetId);
  if (!sig || sig.points.length < 3) return [];

  const arr = route.arrival_airport;
  const arrLon = arr.longitude;
  const arrLat = arr.latitude;
  const centroid = polygonCentroid(sig.points);

  const toDest = bearingDeg(flight.longitude, flight.latitude, arrLon, arrLat);

  const offsetNm = [100, 150];
  const sides: ("LEFT" | "RIGHT")[] = ["LEFT", "RIGHT"];
  const options: RerouteOption[] = [];

  for (const side of sides) {
    for (const nm of offsetNm) {
      const perpendicular = side === "LEFT" ? toDest - 90 : toDest + 90;
      const detourOffset = nm * NM_TO_M;
      const turnPoint = destinationPoint(
        flight.longitude,
        flight.latitude,
        perpendicular,
        detourOffset,
      );

      const headingFromTurn = bearingDeg(
        turnPoint.lon,
        turnPoint.lat,
        arrLon,
        arrLat,
      );
      const centroidBearing = bearingDeg(
        turnPoint.lon,
        turnPoint.lat,
        centroid.lon,
        centroid.lat,
      );
      const bearingDiff = Math.abs(
        ((centroidBearing - headingFromTurn + 540) % 360) - 180,
      );
      if (bearingDiff < 30) continue;

      const directKm = haversineKm(
        flight.longitude,
        flight.latitude,
        arrLon,
        arrLat,
      );
      const detourKm =
        haversineKm(flight.longitude, flight.latitude, turnPoint.lon, turnPoint.lat) +
        haversineKm(turnPoint.lon, turnPoint.lat, arrLon, arrLat);
      const extraKm = detourKm - directKm;

      const velocityMs = flight.velocity ?? 230;
      const extraMin = (extraKm * 1000) / velocityMs / 60;

      const altM = (flight.baro_altitude ?? 10000);

      const midPoint = {
        lon: (turnPoint.lon + arrLon) / 2,
        lat: (turnPoint.lat + arrLat) / 2,
        alt_m: altM,
      };

      options.push({
        id: `${side}-${nm}`,
        side,
        offset_nm: nm,
        waypoints: [
          { lon: flight.longitude, lat: flight.latitude, alt_m: altM },
          { lon: turnPoint.lon, lat: turnPoint.lat, alt_m: altM },
          midPoint,
          { lon: arrLon, lat: arrLat, alt_m: 0 },
        ],
        extra_km: Math.max(0, extraKm),
        extra_min: Math.max(0, extraMin),
      });

      break;
    }
  }

  return options;
}

export { FT_TO_M };
