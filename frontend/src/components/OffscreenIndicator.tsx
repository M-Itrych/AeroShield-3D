import { useState, useEffect, useCallback } from "react";
import {
  Cartesian3,
  SceneTransforms,
  type Viewer as CesiumViewer,
} from "cesium";
import type { FlightVector, RiskAssessment } from "@/types/domain";

interface OffscreenIndicatorProps {
  viewer: CesiumViewer | null;
  flights: FlightVector[];
  risks: RiskAssessment[];
  selectedId?: string | null;
}

interface Indicator {
  icao24: string;
  callsign: string | null;
  x: number;
  y: number;
  angle: number;
}

const EDGE_PADDING = 60;
const UPDATE_MS = 500;
const MAX_INDICATORS = 6;
const BEHIND_GLOBE_THRESHOLD = -1;

export function OffscreenIndicator({
  viewer,
  flights,
  risks,
  selectedId,
}: OffscreenIndicatorProps) {
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  const update = useCallback(() => {
    if (!viewer) {
      setIndicators([]);
      return;
    }

    const highRiskIds = new Set(
      risks.filter((r) => r.risk === "HIGH" && r.flight !== selectedId).map((r) => r.flight),
    );

    const flightMap = new Map(flights.map((f) => [f.icao24, f]));
    const canvas = viewer.scene.canvas as HTMLCanvasElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    const cameraPosition = viewer.camera.positionWC;
    const result: Indicator[] = [];

    for (const id of highRiskIds) {
      const f = flightMap.get(id);
      if (!f) continue;

      const pos = Cartesian3.fromDegrees(f.longitude, f.latitude, f.baro_altitude ?? 10000);

      const toPoint = Cartesian3.subtract(pos, cameraPosition, new Cartesian3());
      const cameraDir = viewer.camera.directionWC;
      const dot = Cartesian3.dot(toPoint, cameraDir);

      if (dot < BEHIND_GLOBE_THRESHOLD) continue;

      const screen = SceneTransforms.worldToWindowCoordinates(viewer.scene, pos);

      if (!screen) continue;

      const sx = screen.x;
      const sy = screen.y;

      if (!isFinite(sx) || !isFinite(sy)) continue;

      const onScreen = sx >= -10 && sx <= w + 10 && sy >= -10 && sy <= h + 10;
      if (onScreen) continue;

      const dx = sx - cx;
      const dy = sy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const angle = Math.atan2(dy, dx);

      const margin = EDGE_PADDING;
      const halfW = (w - margin * 2) / 2;
      const halfH = (h - margin * 2) / 2;

      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));
      let ex: number, ey: number;

      if (halfW * absSin <= halfH * absCos) {
        ex = cx + Math.sign(dx) * halfW;
        ey = cy + Math.sign(dx) * (halfW * Math.tan(angle));
      } else {
        ey = cy + Math.sign(dy) * halfH;
        ex = cx + Math.sign(dy) * (halfH / Math.tan(angle));
      }

      result.push({
        icao24: id,
        callsign: f.callsign,
        x: ex + cx,
        y: ey + cy,
        angle: (angle * 180) / Math.PI,
      });
    }

    result.sort((a, b) => {
      const da = Math.hypot(a.x - cx, a.y - cy);
      const db = Math.hypot(b.x - cx, b.y - cy);
      return da - db;
    });

    setIndicators(result.slice(0, MAX_INDICATORS));
  }, [viewer, flights, risks, selectedId]);

  useEffect(() => {
    if (!viewer) return;

    update();
    const interval = setInterval(update, UPDATE_MS);

    const removeCam = viewer.camera.changed.addEventListener(update);

    return () => {
      clearInterval(interval);
      removeCam();
    };
  }, [viewer, update]);

  if (indicators.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {indicators.map((ind) => (
        <div
          key={ind.icao24}
          className="absolute flex items-center gap-1"
          style={{
            left: `${ind.x}px`,
            top: `${ind.y}px`,
            transform: `translate(-50%, -50%) rotate(${ind.angle}deg)`,
          }}
        >
          <div className="flex items-center gap-1 border border-hud-warn/60 bg-hud-space/90 px-1.5 py-0.5 backdrop-blur-sm">
            <span
              className="font-mono text-[9px] font-bold text-hud-warn"
              style={{ transform: `rotate(${-ind.angle}deg)` }}
            >
              {ind.callsign?.trim() ?? ind.icao24.slice(-4).toUpperCase()}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
              <path d="M5 0 L10 8 L5 6 L0 8 Z" fill="#ff5f1f" fillOpacity="0.9" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
