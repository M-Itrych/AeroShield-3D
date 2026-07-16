import { Entity } from "resium";
import {
  Cartesian3,
  Cartesian2,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  DistanceDisplayCondition,
  Math as CesiumMath,
  type Viewer as CesiumViewer,
} from "cesium";
import { useMemo } from "react";
import type { FlightVector, RiskAssessment } from "@/types/domain";
import type { BboxParams } from "@/hooks/use-viewport-bbox";
import {
  FLIGHT_ICON_LIME,
  FLIGHT_ICON_ORANGE,
  FLIGHT_ICON_LIME_DIM,
  FLIGHT_ICON_ORANGE_DIM,
} from "@/lib/flight-icons";

interface FlightLayerProps {
  flights: FlightVector[];
  risks?: RiskAssessment[];
  onSelect?: (icao24: string) => void;
  viewer?: CesiumViewer | null;
  viewportBbox?: BboxParams;
  selectedId?: string | null;
}

const MAX_FLIGHTS = 500;

const LABEL_FILL = Color.fromCssColorString("#e8eef2").withAlpha(0.92);
const LABEL_OUTLINE = Color.fromCssColorString("#08080a").withAlpha(0.9);
const LABEL_BG = Color.fromCssColorString("#08080a").withAlpha(0.55);

const LABEL_OFFSET = new Cartesian2(16, -10);
const LABEL_PADDING = new Cartesian2(4, 2);

const LABEL_NEAR_FAR = { near: 0, far: 3_000_000 } as const;
const POINT_NEAR_FAR = { near: 0, far: 60_000_000 } as const;

function buildRiskMap(risks?: RiskAssessment[]): Map<string, string> {
  const m = new Map<string, string>();
  if (risks) for (const r of risks) m.set(r.flight, r.risk);
  return m;
}

function tacticalLabel(f: FlightVector): string {
  const cs = f.callsign?.trim();
  const suffix = f.icao24.slice(-4).toUpperCase();
  if (cs) return `${cs} ${suffix}`;
  return `SYS-${f.icao24.slice(0, 6).toUpperCase()}`;
}

function dedupeByIcao(flights: FlightVector[]): FlightVector[] {
  const seen = new Set<string>();
  const out: FlightVector[] = [];
  for (const f of flights) {
    if (seen.has(f.icao24)) continue;
    seen.add(f.icao24);
    out.push(f);
  }
  return out;
}

function inBbox(f: FlightVector, b: BboxParams): boolean {
  return (
    f.latitude >= b.lamin &&
    f.latitude <= b.lamax &&
    f.longitude >= b.lomin &&
    f.longitude <= b.lomax
  );
}

export function FlightLayer({
  flights,
  risks,
  viewportBbox,
  selectedId,
}: FlightLayerProps) {
  const riskMap = useMemo(() => buildRiskMap(risks), [risks]);

  const visible = useMemo(() => {
    const deduped = dedupeByIcao(flights);

    if (!viewportBbox) {
      return deduped.slice(0, MAX_FLIGHTS);
    }

    const inView = deduped.filter((f) => inBbox(f, viewportBbox));

    if (inView.length <= MAX_FLIGHTS) return inView;

    const high: FlightVector[] = [];
    const med: FlightVector[] = [];
    const rest: FlightVector[] = [];

    for (const f of inView) {
      const r = riskMap.get(f.icao24) ?? "NONE";
      if (r === "HIGH") high.push(f);
      else if (r === "MEDIUM") med.push(f);
      else rest.push(f);
    }

    if (high.length >= MAX_FLIGHTS) return high.slice(0, MAX_FLIGHTS);

    const result = [...high, ...med];
    if (result.length >= MAX_FLIGHTS) return result.slice(0, MAX_FLIGHTS);

    const remaining = MAX_FLIGHTS - result.length;
    const stride = Math.max(1, Math.floor(rest.length / remaining));
    const sampled = rest.filter((_, i) => i % stride === 0).slice(0, remaining);
    return [...result, ...sampled];
  }, [flights, riskMap, viewportBbox]);

  return (
    <>
      {visible.map((f) => {
        const alt = f.baro_altitude ?? 10000;
        const position = Cartesian3.fromDegrees(f.longitude, f.latitude, alt);
        const riskLevel = riskMap.get(f.icao24) ?? "NONE";
        const isHigh = riskLevel === "HIGH";
        const isWarn = isHigh || riskLevel === "MEDIUM";
        const isSelected = selectedId === f.icao24;

        const altFt = (f.baro_altitude ?? 0) * 3.28084;
        let icon: string;
        if (isWarn) {
          icon = isHigh ? FLIGHT_ICON_ORANGE : FLIGHT_ICON_ORANGE_DIM;
        } else {
          icon = altFt > 30000 ? FLIGHT_ICON_LIME : FLIGHT_ICON_LIME_DIM;
        }

        const scale = isHigh ? 0.85 : isWarn ? 0.7 : isSelected ? 0.75 : 0.55;
        const rotation = f.heading != null ? -CesiumMath.toRadians(f.heading) : 0;
        const showLabel = isWarn || isSelected;

        return (
          <Entity
            key={f.icao24}
            position={position}
            id={f.icao24}
            billboard={{
              image: icon,
              scale,
              rotation,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: HeightReference.NONE,
              distanceDisplayCondition: new DistanceDisplayCondition(
                POINT_NEAR_FAR.near,
                POINT_NEAR_FAR.far,
              ),
            }}
            label={
              showLabel
                ? {
                    text: tacticalLabel(f),
                    font: '10px "JetBrains Mono", ui-monospace, monospace',
                    fillColor: LABEL_FILL,
                    outlineColor: LABEL_OUTLINE,
                    outlineWidth: 2,
                    style: LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: VerticalOrigin.CENTER,
                    horizontalOrigin: HorizontalOrigin.LEFT,
                    pixelOffset: LABEL_OFFSET,
                    showBackground: true,
                    backgroundColor: LABEL_BG,
                    backgroundPadding: LABEL_PADDING,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: HeightReference.NONE,
                    distanceDisplayCondition: new DistanceDisplayCondition(
                      LABEL_NEAR_FAR.near,
                      LABEL_NEAR_FAR.far,
                    ),
                  }
                : undefined
            }
          />
        );
      })}
    </>
  );
}
