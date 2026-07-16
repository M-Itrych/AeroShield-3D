import { Entity } from "resium";
import {
  Cartesian3,
  Color,
  PolygonHierarchy,
  ColorMaterialProperty,
  HeightReference,
  ArcType,
  ConstantProperty,
  DistanceDisplayCondition,
} from "cesium";
import { memo, useMemo } from "react";
import type { HazardPolygon, FlightVector } from "@/types/domain";
import type { BboxParams } from "@/hooks/use-viewport-bbox";

interface HazardLayerProps {
  sigmets: HazardPolygon[];
  selectedFlight?: FlightVector | null;
  viewportBbox?: BboxParams;
}

const FT_TO_M = 0.3048;
const GROUND_FT = 0;

const HAZARD_FILL_FULL = Color.fromCssColorString("#ff5f1f").withAlpha(0.12);
const HAZARD_OUTLINE_FULL = Color.fromCssColorString("#ff5f1f").withAlpha(0.7);
const HAZARD_FILL_DIM = Color.fromCssColorString("#ff5f1f").withAlpha(0.04);
const HAZARD_OUTLINE_DIM = Color.fromCssColorString("#ff5f1f").withAlpha(0.2);

const DEFAULT_MIN_FT = 0;
const DEFAULT_MAX_FT = 60000;

const HAZARD_NEAR_FAR = new DistanceDisplayCondition(0, 15_000_000);

function altBandIntersectsFlight(
  sig: HazardPolygon,
  flightAltFt: number | null,
): boolean {
  if (flightAltFt == null) return true;
  const min = sig.min_ft ?? DEFAULT_MIN_FT;
  const max = sig.max_ft ?? DEFAULT_MAX_FT;
  return flightAltFt >= min && flightAltFt <= max;
}

function polygonOverlapsBbox(sig: HazardPolygon, b: BboxParams): boolean {
  let hasOutside = false;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of sig.points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (maxLon < b.lomin || minLon > b.lomax) hasOutside = true;
  if (maxLat < b.lamin || minLat > b.lamax) hasOutside = true;
  return !hasOutside;
}

export const HazardLayer = memo(function HazardLayer({
  sigmets,
  selectedFlight,
  viewportBbox,
}: HazardLayerProps) {
  const flightAltFt = selectedFlight?.baro_altitude
    ? selectedFlight.baro_altitude * 3.28084
    : null;

  const entities = useMemo(
    () =>
      sigmets
        .filter((sig) =>
          viewportBbox ? polygonOverlapsBbox(sig, viewportBbox) : true,
        )
        .map((sig) => {
        const coords: number[] = [];
        for (const [lon, lat] of sig.points) {
          coords.push(lon, lat);
        }

        const minFt = sig.min_ft ?? GROUND_FT;
        const maxFt = sig.max_ft ?? DEFAULT_MAX_FT;
        const minM = minFt * FT_TO_M;
        const maxM = maxFt * FT_TO_M;

        const intersects = altBandIntersectsFlight(sig, flightAltFt);
        const fill = intersects ? HAZARD_FILL_FULL : HAZARD_FILL_DIM;
        const outline = intersects ? HAZARD_OUTLINE_FULL : HAZARD_OUTLINE_DIM;

        const hierarchy = new PolygonHierarchy(
          Cartesian3.fromDegreesArray(coords),
        );

        const extrudedHeightProp = new ConstantProperty(maxM);

        return (
          <Entity
            key={sig.sigmet_id}
            id={sig.sigmet_id}
            name={`SIGMET ${sig.sigmet_id} (${sig.hazard_type}) FL${Math.round(minFt / 100)}-FL${Math.round(maxFt / 100)}`}
            polygon={{
              hierarchy,
              material: new ColorMaterialProperty(fill),
              outline: true,
              outlineColor: outline,
              height: minM,
              extrudedHeight: extrudedHeightProp,
              heightReference: HeightReference.NONE,
              fill: true,
              arcType: ArcType.GEODESIC,
              distanceDisplayCondition: HAZARD_NEAR_FAR,
            }}
          />
        );
      }),
    [sigmets, flightAltFt, viewportBbox],
  );

  return <>{entities}</>;
});

