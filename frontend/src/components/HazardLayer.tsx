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
  CallbackProperty,
  JulianDate,
  type JulianDate as JulianDateType,
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
const OUTLINE_BASE = Color.fromCssColorString("#ff5f1f");
const HAZARD_FILL_FULL = Color.fromCssColorString("#ff5f1f").withAlpha(0.12);
const HAZARD_FILL_DIM = Color.fromCssColorString("#ff5f1f").withAlpha(0.04);
const HAZARD_OUTLINE_DIM = Color.fromCssColorString("#ff5f1f").withAlpha(0.2);

const DEFAULT_MIN_FT = 0;
const DEFAULT_MAX_FT = 60000;

const HAZARD_NEAR_FAR = new DistanceDisplayCondition(0, 8_000_000);

const PULSE_PERIOD_S = 1.6;
const PULSE_EPOCH = JulianDate.now();

function createPulsingOutline(): CallbackProperty {
  return new CallbackProperty((time?: JulianDateType) => {
    const t = time ?? JulianDate.now();
    const elapsed = JulianDate.secondsDifference(t, PULSE_EPOCH);
    const phase = (elapsed % PULSE_PERIOD_S) / PULSE_PERIOD_S;
    const wave = (1 + Math.sin(phase * 2 * Math.PI)) / 2;
    const alpha = 0.4 + 0.4 * wave;
    return OUTLINE_BASE.withAlpha(alpha);
  }, false);
}

function altBandIntersectsFlight(
  sig: HazardPolygon,
  flightAltFt: number | null,
): boolean {
  if (flightAltFt == null) return true;
  const min = sig.min_ft ?? DEFAULT_MIN_FT;
  const max = sig.max_ft ?? DEFAULT_MAX_FT;
  return flightAltFt >= min && flightAltFt <= max;
}

interface Slab {
  lomin: number;
  lomax: number;
  lamin: number;
  lamax: number;
}

function bboxToSlabs(b: BboxParams): Slab[] {
  if (b.lomin <= -180 && b.lomax >= 180) {
    return [{ lomin: -180, lomax: 180, lamin: b.lamin, lamax: b.lamax }];
  }
  if (b.lomin > b.lomax) {
    return [
      { lomin: b.lomin, lomax: 180, lamin: b.lamin, lamax: b.lamax },
      { lomin: -180, lomax: b.lomax, lamin: b.lamin, lamax: b.lamax },
    ];
  }
  return [{ lomin: b.lomin, lomax: b.lomax, lamin: b.lamin, lamax: b.lamax }];
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMax >= bMin && aMin <= bMax;
}

function polygonLonRange(points: [number, number][]) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lon] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const crossesAntimeridian = maxLon - minLon > 180;
  return {
    crossesAntimeridian,
    minLon,
    maxLon,
    rightLobe: [maxLon, 180] as const,
    leftLobe: [-180, minLon] as const,
  };
}

function polygonLatRange(points: [number, number][]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [, lat] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLat, maxLat };
}

function polygonOverlapsBbox(sig: HazardPolygon, b: BboxParams): boolean {
  const slabs = bboxToSlabs(b);
  const { minLat, maxLat } = polygonLatRange(sig.points);
  const lr = polygonLonRange(sig.points);
  for (const slab of slabs) {
    if (!rangesOverlap(minLat, maxLat, slab.lamin, slab.lamax)) continue;
    if (!lr.crossesAntimeridian) {
      if (rangesOverlap(lr.minLon, lr.maxLon, slab.lomin, slab.lomax)) return true;
    } else {
      if (rangesOverlap(lr.rightLobe[0], lr.rightLobe[1], slab.lomin, slab.lomax)) {
        return true;
      }
      if (rangesOverlap(lr.leftLobe[0], lr.leftLobe[1], slab.lomin, slab.lomax)) {
        return true;
      }
    }
  }
  return false;
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
        const outlineColor = intersects
          ? createPulsingOutline()
          : new ConstantProperty(HAZARD_OUTLINE_DIM);

        const hierarchy = new PolygonHierarchy(
          Cartesian3.fromDegreesArray(coords),
        );

        const shouldExtrude = selectedFlight != null;

        return (
          <Entity
            key={sig.sigmet_id}
            id={sig.sigmet_id}
            name={`SIGMET ${sig.sigmet_id} (${sig.hazard_type}) FL${Math.round(minFt / 100)}-FL${Math.round(maxFt / 100)}`}
            polygon={{
              hierarchy,
              material: new ColorMaterialProperty(fill),
              outline: true,
              outlineColor: outlineColor,
              height: shouldExtrude ? minM : 0,
              extrudedHeight: shouldExtrude ? maxM : undefined,
              heightReference: HeightReference.NONE,
              fill: true,
              arcType: ArcType.GEODESIC,
              distanceDisplayCondition: HAZARD_NEAR_FAR,
            }}
          />
        );
      }),
    [sigmets, flightAltFt, viewportBbox, selectedFlight],
  );

  return <>{entities}</>;
});

