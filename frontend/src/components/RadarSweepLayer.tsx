import { Entity, EllipseGraphics } from "resium";
import {
  Cartesian3,
  Color,
  HeightReference,
  CallbackProperty,
  JulianDate,
  DistanceDisplayCondition,
  ColorMaterialProperty,
} from "cesium";
import type { FlightVector } from "@/types/domain";

interface RadarSweepLayerProps {
  flight: FlightVector | null;
}

const SWEEP_PERIOD_S = 2.0;
const MIN_RADIUS_M = 5_000;
const MAX_RADIUS_M = 60_000;
const RING_COLOR_BASE = Color.fromCssColorString("#39ff14");
const NEAR_FAR = new DistanceDisplayCondition(0, 5_000_000);
const EPOCH = JulianDate.now();

function createSweepRadius(): CallbackProperty {
  return new CallbackProperty(() => {
    const now = JulianDate.now();
    const elapsed = JulianDate.secondsDifference(now, EPOCH);
    const phase = (elapsed % SWEEP_PERIOD_S) / SWEEP_PERIOD_S;
    return MIN_RADIUS_M + (MAX_RADIUS_M - MIN_RADIUS_M) * phase;
  }, false);
}

function createSweepColor(): CallbackProperty {
  return new CallbackProperty(() => {
    const now = JulianDate.now();
    const elapsed = JulianDate.secondsDifference(now, EPOCH);
    const phase = (elapsed % SWEEP_PERIOD_S) / SWEEP_PERIOD_S;
    const alpha = 0.4 * (1 - phase);
    return RING_COLOR_BASE.withAlpha(alpha);
  }, false);
}

export function RadarSweepLayer({ flight }: RadarSweepLayerProps) {
  if (!flight) return null;

  const position = Cartesian3.fromDegrees(
    flight.longitude,
    flight.latitude,
    flight.baro_altitude ?? 10000,
  );

  const radiusProp = createSweepRadius();
  const colorProp = createSweepColor();

  return (
    <Entity position={position} name={`radar-sweep-${flight.icao24}`}>
      <EllipseGraphics
        semiMajorAxis={radiusProp}
        semiMinorAxis={radiusProp}
        material={new ColorMaterialProperty(colorProp)}
        heightReference={HeightReference.NONE}
        distanceDisplayCondition={NEAR_FAR}
        fill={true}
        outline={true}
        outlineColor={colorProp}
      />
    </Entity>
  );
}
