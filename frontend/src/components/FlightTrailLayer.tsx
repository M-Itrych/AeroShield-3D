import { Entity, PolylineGraphics, PointGraphics } from "resium";
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ArcType,
  HeightReference,
} from "cesium";
import type { TrailPoint } from "@/types/domain";

interface FlightTrailLayerProps {
  trail: TrailPoint[];
  icao24: string | null;
}

const ORIGIN_CORE = Color.fromCssColorString("#39ff14").withAlpha(0.95);
const ORIGIN_RING = Color.fromCssColorString("#39ff14").withAlpha(0.35);
const TRACK_BG = Color.fromCssColorString("#08080a").withAlpha(0.8);

function altFt(p: TrailPoint): number {
  return (p.alt_m ?? 0) * 3.28084;
}

function altitudeColor(p: TrailPoint): Color {
  const ft = altFt(p);
  if (ft < 10000) return Color.fromCssColorString("#5a6770").withAlpha(0.7);
  if (ft < 25000) return Color.fromCssColorString("#39ff14").withAlpha(0.6);
  if (ft < 40000) return Color.fromCssColorString("#ff5f1f").withAlpha(0.65);
  return Color.fromCssColorString("#ff5f1f").withAlpha(0.85);
}

export function FlightTrailLayer({ trail, icao24 }: FlightTrailLayerProps) {
  if (!icao24 || trail.length < 2) return null;

  const segments: React.ReactNode[] = [];

  for (let i = 0; i < trail.length - 1; i++) {
    const p1 = trail[i];
    const p2 = trail[i + 1];
    const positions = Cartesian3.fromDegreesArrayHeights([
      p1.lon,
      p1.lat,
      p1.alt_m ?? 10000,
      p2.lon,
      p2.lat,
      p2.alt_m ?? 10000,
    ]);
    const color = altitudeColor(p2);

    segments.push(
      <Entity key={`trail-seg-${icao24}-${i}`} name={`trail-${icao24}`}>
        <PolylineGraphics
          positions={positions}
          width={2}
          material={new ColorMaterialProperty(color)}
          arcType={ArcType.NONE}
        />
      </Entity>,
    );
  }

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

  return (
    <>
      {segments}
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
          outlineColor={altitudeColor(current).withAlpha(0.5)}
          outlineWidth={2}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
        />
      </Entity>
    </>
  );
}
