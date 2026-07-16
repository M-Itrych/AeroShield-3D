import { useEffect, useMemo, useRef } from "react";
import {
  Cartesian3,
  Cartesian2,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  Math as CesiumMath,
  type Viewer as CesiumViewer,
  BillboardCollection,
  LabelCollection,
  DistanceDisplayCondition,
} from "cesium";
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
  viewer?: CesiumViewer | null;
  viewportBbox?: BboxParams;
  selectedId?: string | null;
}

const MAX_FLIGHTS = 150;

const LABEL_FILL = Color.fromCssColorString("#e8eef2").withAlpha(0.92);
const LABEL_OUTLINE = Color.fromCssColorString("#08080a").withAlpha(0.9);
const LABEL_BG = Color.fromCssColorString("#08080a").withAlpha(0.55);

const LABEL_OFFSET = new Cartesian2(16, -10);
const LABEL_PADDING = new Cartesian2(4, 2);

const LABEL_NEAR_FAR = new DistanceDisplayCondition(0, 3_000_000);
const POINT_NEAR_FAR = new DistanceDisplayCondition(0, 60_000_000);

const ICONS = {
  lime: FLIGHT_ICON_LIME,
  orange: FLIGHT_ICON_ORANGE,
  limeDim: FLIGHT_ICON_LIME_DIM,
  orangeDim: FLIGHT_ICON_ORANGE_DIM,
} as const;

function buildRiskMap(risks?: RiskAssessment[]): Map<string, RiskAssessment> {
  const m = new Map<string, RiskAssessment>();
  if (risks) for (const r of risks) m.set(r.flight, r);
  return m;
}

function tacticalLabel(f: FlightVector, risk?: RiskAssessment): string {
  const cs = f.callsign?.trim();
  const suffix = f.icao24.slice(-4).toUpperCase();
  const base = cs ? `${cs} ${suffix}` : `SYS-${f.icao24.slice(0, 6).toUpperCase()}`;
  if (risk?.minutes_to_impact != null && risk.minutes_to_impact > 0) {
    return `${base} T${Math.ceil(risk.minutes_to_impact)}M`;
  }
  return base;
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

interface PreparedFlight {
  icao24: string;
  lon: number;
  lat: number;
  alt: number;
  heading: number | null;
  callsign: string | null;
  icao24Raw: string;
  risk: RiskAssessment | undefined;
  riskLevel: string;
  isHigh: boolean;
  isWarn: boolean;
  icon: string;
  scale: number;
  showLabel: boolean;
}

function selectIcon(isHigh: boolean, isWarn: boolean, altFt: number): string {
  if (isWarn) return isHigh ? ICONS.orange : ICONS.orangeDim;
  return altFt > 30000 ? ICONS.lime : ICONS.limeDim;
}

export function FlightLayer({
  flights,
  risks,
  viewer,
  viewportBbox,
  selectedId,
}: FlightLayerProps) {
  const riskMap = useMemo(() => buildRiskMap(risks), [risks]);

  const billboardsRef = useRef<BillboardCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);

  const prepared = useMemo<PreparedFlight[]>(() => {
    const deduped = dedupeByIcao(flights);

    const selected = selectedId
      ? deduped.find((f) => f.icao24 === selectedId)
      : undefined;

    let pool: FlightVector[];
    if (!viewportBbox) {
      pool = deduped.slice(0, MAX_FLIGHTS);
    } else {
      const inView = deduped.filter((f) => inBbox(f, viewportBbox));
      if (inView.length <= MAX_FLIGHTS) {
        pool = inView;
      } else {
        const high: FlightVector[] = [];
        const med: FlightVector[] = [];
        const rest: FlightVector[] = [];
        for (const f of inView) {
          const r = riskMap.get(f.icao24)?.risk ?? "NONE";
          if (r === "HIGH") high.push(f);
          else if (r === "MEDIUM") med.push(f);
          else rest.push(f);
        }
        if (high.length >= MAX_FLIGHTS) {
          pool = high.slice(0, MAX_FLIGHTS);
        } else {
          const result = [...high, ...med];
          if (result.length >= MAX_FLIGHTS) {
            pool = result.slice(0, MAX_FLIGHTS);
          } else {
            const remaining = MAX_FLIGHTS - result.length;
            const stride = Math.max(1, Math.floor(rest.length / remaining));
            const sampled = rest
              .filter((_, i) => i % stride === 0)
              .slice(0, remaining);
            pool = [...result, ...sampled];
          }
        }
      }
    }

    if (selected && !pool.some((f) => f.icao24 === selectedId)) {
      pool.push(selected);
    }

    return pool.map((f) => {
      const flightRisk = riskMap.get(f.icao24);
      const riskLevel = flightRisk?.risk ?? "NONE";
      const isHigh = riskLevel === "HIGH";
      const isWarn = isHigh || riskLevel === "MEDIUM";
      const isSelected = selectedId === f.icao24;
      const altFt = (f.baro_altitude ?? 0) * 3.28084;
      const icon = isSelected
        ? ICONS.orange
        : selectIcon(isHigh, isWarn, altFt);
      const scale = isSelected
        ? 1.1
        : isHigh
          ? 0.85
          : isWarn
            ? 0.7
            : 0.5;
      return {
        icao24: f.icao24,
        lon: f.longitude,
        lat: f.latitude,
        alt: f.baro_altitude ?? 10000,
        heading: f.heading,
        callsign: f.callsign,
        icao24Raw: f.icao24,
        risk: flightRisk,
        riskLevel,
        isHigh,
        isWarn,
        icon,
        scale,
        showLabel: isWarn || isSelected,
      };
    });
  }, [flights, riskMap, viewportBbox, selectedId]);

  useEffect(() => {
    if (!viewer) return;

    const billboards = new BillboardCollection();
    const labels = new LabelCollection();
    viewer.scene.primitives.add(billboards);
    viewer.scene.primitives.add(labels);
    billboardsRef.current = billboards;
    labelsRef.current = labels;

    return () => {
      viewer.scene.primitives.remove(billboards);
      viewer.scene.primitives.remove(labels);
      billboardsRef.current = null;
      labelsRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const billboards = billboardsRef.current;
    const labels = labelsRef.current;
    if (!billboards || !labels) return;

    billboards.removeAll();
    labels.removeAll();

    for (const f of prepared) {
      const position = Cartesian3.fromDegrees(f.lon, f.lat, f.alt);
      const rotation = f.heading != null ? -CesiumMath.toRadians(f.heading) : 0;

      const bb = billboards.add({
        image: f.icon,
        position,
        scale: f.scale,
        rotation,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: HeightReference.NONE,
        distanceDisplayCondition: POINT_NEAR_FAR,
      });
      bb.id = f.icao24;

      if (f.showLabel) {
        const lbl = labels.add({
          position,
          text: tacticalLabel(
            { callsign: f.callsign, icao24: f.icao24Raw } as FlightVector,
            f.risk,
          ),
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
          distanceDisplayCondition: LABEL_NEAR_FAR,
        });
        lbl.id = f.icao24;
      }
    }
  }, [prepared]);

  return null;
}
