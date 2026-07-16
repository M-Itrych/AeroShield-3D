import { Entity, EllipseGraphics } from "resium";
import {
  Cartesian3,
  Color,
  HeightReference,
  CallbackProperty,
  JulianDate,
  DistanceDisplayCondition,
  ColorMaterialProperty,
  type JulianDate as JulianDateType,
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

class SweepProperty {
  private lastTime: JulianDateType | null = null;
  private cachedRadius = MIN_RADIUS_M;
  private cachedAlpha = 0.4;

  private compute(time?: JulianDateType) {
    const t = time ?? JulianDate.now();
    if (this.lastTime === t) {
      return;
    }
    this.lastTime = t;
    const elapsed = JulianDate.secondsDifference(t, EPOCH);
    const phase = (elapsed % SWEEP_PERIOD_S) / SWEEP_PERIOD_S;
    this.cachedRadius = MIN_RADIUS_M + (MAX_RADIUS_M - MIN_RADIUS_M) * phase;
    this.cachedAlpha = 0.4 * (1 - phase);
  }

  getRadius(time?: JulianDateType): number {
    this.compute(time);
    return this.cachedRadius;
  }

  getColor(time?: JulianDateType): Color {
    this.compute(time);
    return RING_COLOR_BASE.withAlpha(this.cachedAlpha);
  }
}

export function RadarSweepLayer({ flight }: RadarSweepLayerProps) {
  if (!flight) return null;

  const position = Cartesian3.fromDegrees(
    flight.longitude,
    flight.latitude,
    flight.baro_altitude ?? 10000,
  );

  const sweep = new SweepProperty();

  const radiusProp = new CallbackProperty((time?: JulianDateType) => {
    return sweep.getRadius(time);
  }, false);

  const colorProp = new CallbackProperty((time?: JulianDateType) => {
    return sweep.getColor(time);
  }, false);

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
