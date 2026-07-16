import { Entity, PolylineGraphics, PointGraphics } from "resium";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ArcType,
  HeightReference,
} from "cesium";
import type { FlightRoute, FlightVector } from "@/types/domain";

interface RouteLineLayerProps {
  route: FlightRoute | null;
  flight: FlightVector | null;
}

const ROUTE_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.4);
const DEP_CORE = Color.fromCssColorString("#39ff14").withAlpha(0.95);
const DEP_RING = Color.fromCssColorString("#39ff14").withAlpha(0.35);
const ARR_CORE = Color.fromCssColorString("#ff5f1f").withAlpha(0.95);
const ARR_RING = Color.fromCssColorString("#ff5f1f").withAlpha(0.4);
const TRACK_BG = Color.fromCssColorString("#08080a").withAlpha(0.8);

function buildGreatCirclePoints(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  segments: number = 64,
): number[] {
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = lat1 + (lat2 - lat1) * t;
    const lon = lon1 + (lon2 - lon1) * t;
    points.push(lon, lat, 8000);
  }
  return points;
}

export function RouteLineLayer({ route, flight }: RouteLineLayerProps) {
  if (!route) return null;
  const dep = route.departure_airport;
  const arr = route.arrival_airport;

  const entities: React.ReactNode[] = [];

  if (dep && arr) {
    const coords = buildGreatCirclePoints(
      dep.longitude,
      dep.latitude,
      arr.longitude,
      arr.latitude,
    );
    entities.push(
      <Entity key="route-line" name={`route-${route.icao24}`}>
        <PolylineGraphics
          positions={Cartesian3.fromDegreesArrayHeights(coords)}
          width={1.5}
          material={new ColorMaterialProperty(ROUTE_COLOR)}
          arcType={ArcType.NONE}
        />
      </Entity>,
    );
  } else if (dep && flight) {
    const coords = buildGreatCirclePoints(
      dep.longitude,
      dep.latitude,
      flight.longitude,
      flight.latitude,
    );
    entities.push(
      <Entity key="route-line-partial" name={`route-${route.icao24}`}>
        <PolylineGraphics
          positions={Cartesian3.fromDegreesArrayHeights(coords)}
          width={1.5}
          material={new ColorMaterialProperty(ROUTE_COLOR)}
          arcType={ArcType.NONE}
        />
      </Entity>,
    );
  }

  if (dep) {
    const depPos = Cartesian3.fromDegrees(dep.longitude, dep.latitude, 50);
    entities.push(
      <Entity key="route-dep-ring" position={depPos}>
        <PointGraphics
          pixelSize={14}
          color={Color.TRANSPARENT}
          outlineColor={DEP_RING}
          outlineWidth={1.5}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>,
      <Entity key="route-dep" position={depPos} name={`DEP ${dep.icao} ${dep.name}`}>
        <PointGraphics
          pixelSize={4}
          color={DEP_CORE}
          outlineColor={TRACK_BG}
          outlineWidth={1}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>,
    );
  }

  if (arr) {
    const arrPos = Cartesian3.fromDegrees(arr.longitude, arr.latitude, 50);
    entities.push(
      <Entity key="route-arr-ring" position={arrPos}>
        <PointGraphics
          pixelSize={14}
          color={Color.TRANSPARENT}
          outlineColor={ARR_RING}
          outlineWidth={1.5}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>,
      <Entity key="route-arr" position={arrPos} name={`ARR ${arr.icao} ${arr.name}`}>
        <PointGraphics
          pixelSize={4}
          color={ARR_CORE}
          outlineColor={TRACK_BG}
          outlineWidth={1}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>,
    );
  }

  return <>{entities}</>;
}
