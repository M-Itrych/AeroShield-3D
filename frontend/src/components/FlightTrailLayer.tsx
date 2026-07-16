import { Entity, PolylineGraphics, PointGraphics } from "resium";
import {
  Cartesian3,
  Color,
  PolylineGlowMaterialProperty,
  ArcType,
  HeightReference,
} from "cesium";
import { useMemo } from "react";
import type { TrailPoint } from "@/types/domain";

interface FlightTrailLayerProps {
  trail: TrailPoint[];
  icao24: string | null;
}

const ORIGIN_CORE = Color.fromCssColorString("#39ff14").withAlpha(0.95);
const ORIGIN_RING = Color.fromCssColorString("#39ff14").withAlpha(0.35);
const TRACK_BG = Color.fromCssColorString("#08080a").withAlpha(0.8);
const TRAIL_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.7);
const TRAIL_HEAD_RING = Color.fromCssColorString("#39ff14").withAlpha(0.5);

export function FlightTrailLayer({ trail, icao24 }: FlightTrailLayerProps) {
  const { positions, originPos, currentPos } = useMemo(() => {
    if (!icao24 || trail.length < 2) {
      return { positions: null, originPos: null, currentPos: null };
    }

    const coords: number[] = [];
    for (const p of trail) {
      coords.push(p.lon, p.lat, p.alt_m ?? 10000);
    }
    const positions = Cartesian3.fromDegreesArrayHeights(coords);

    const origin = trail[0];
    const originPos = Cartesian3.fromDegrees(
      origin.lon,
      origin.lat,
      origin.alt_m ?? 10000,
    );

    const current = trail[trail.length - 1];
    const currentPos = Cartesian3.fromDegrees(
      current.lon,
      current.lat,
      current.alt_m ?? 10000,
    );

    return { positions, originPos, currentPos };
  }, [trail, icao24]);

  if (!icao24 || !positions || !originPos || !currentPos) return null;

  return (
    <>
      <Entity name={`trail-${icao24}`}>
        <PolylineGraphics
          positions={positions}
          width={4}
          material={
            new PolylineGlowMaterialProperty({
              glowPower: 0.3,
              taperPower: 0.3,
              color: TRAIL_COLOR,
            })
          }
          arcType={ArcType.NONE}
        />
      </Entity>
      <Entity name={`trail-origin-${icao24}`} position={originPos}>
        <PointGraphics
          pixelSize={13}
          color={Color.TRANSPARENT}
          outlineColor={ORIGIN_RING}
          outlineWidth={1.5}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>
      <Entity name={`trail-origin-core-${icao24}`} position={originPos}>
        <PointGraphics
          pixelSize={4}
          color={ORIGIN_CORE}
          outlineColor={TRACK_BG}
          outlineWidth={1}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>
      <Entity name={`trail-head-${icao24}`} position={currentPos}>
        <PointGraphics
          pixelSize={8}
          color={Color.TRANSPARENT}
          outlineColor={TRAIL_HEAD_RING}
          outlineWidth={2}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>
    </>
  );
}
