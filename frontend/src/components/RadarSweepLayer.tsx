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
import { useRef } from "react";
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

export function RadarSweepLayer({ flight }: RadarSweepLayerProps) {
  const sharedRef = useRef({ radius: MIN_RADIUS_M, alpha: 0.4 });

  if (!flight) return null;

  const position = Cartesian3.fromDegrees(
    flight.longitude,
    flight.latitude,
    flight.baro_altitude ?? 10000,
  );

  const computeFrame = () => {
    const now = JulianDate.now();
    const elapsed = JulianDate.secondsDifference(now, EPOCH);
    const phase = (elapsed % SWEEP_PERIOD_S) / SWEEP_PERIOD_S;
    sharedRef.current.radius = MIN_RADIUS_M + (MAX_RADIUS_M - MIN_RADIUS_M) * phase;
    sharedRef.current.alpha = 0.4 * (1 - phase);
  };

  const radiusProp = new CallbackProperty(() => {
    computeFrame();
    return sharedRef.current.radius;
  }, false);

  const colorProp = new CallbackProperty(() => {
    return RING_COLOR_BASE.withAlpha(sharedRef.current.alpha);
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
