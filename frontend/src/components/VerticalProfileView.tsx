import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Mountain, TriangleAlert } from "lucide-react";
import type { FlightVector, FlightRoute, HazardPolygon, TrailPoint } from "@/types/domain";
import { haversineKm } from "@/lib/reroute-utils";

interface VerticalProfileViewProps {
  flight: FlightVector | null;
  route: FlightRoute | null;
  trail: TrailPoint[];
  sigmets: HazardPolygon[];
}

const CHART_HEIGHT = 160;
const CHART_PADDING = { top: 16, right: 40, bottom: 24, left: 8 };
const MAX_ALT_FT = 45000;
const FT_TO_M = 0.3048;

interface ProfilePoint {
  distKm: number;
  altFt: number;
  lon: number;
  lat: number;
}

export function VerticalProfileView({
  flight,
  route,
  trail,
  sigmets,
}: VerticalProfileViewProps) {
  const [expanded, setExpanded] = useState(false);

  const data = useMemo(() => {
    if (!flight) return null;

    const trailPoints: ProfilePoint[] = [];
    let cumDist = 0;
    if (trail.length >= 2) {
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        if (i > 0) {
          cumDist += haversineKm(trail[i - 1].lon, trail[i - 1].lat, p.lon, p.lat);
        }
        trailPoints.push({
          distKm: cumDist,
          altFt: (p.alt_m ?? 10000) / FT_TO_M,
          lon: p.lon,
          lat: p.lat,
        });
      }
    }

    const currentDist = cumDist;
    const currentAltFt = (flight.baro_altitude ?? 10000) / FT_TO_M;
    if (trailPoints.length === 0) {
      trailPoints.push({
        distKm: 0,
        altFt: currentAltFt,
        lon: flight.longitude,
        lat: flight.latitude,
      });
    }

    const projectedPoints: ProfilePoint[] = [];
    const arr = route?.arrival_airport;
    if (arr) {
      const totalToArr = haversineKm(flight.longitude, flight.latitude, arr.longitude, arr.latitude);
      const cruiseAltM = flight.baro_altitude ?? 10000;
      const descentStartFrac = totalToArr > 300 ? 0.7 : 0.5;
      const segments = 24;

      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const lat = flight.latitude + (arr.latitude - flight.latitude) * t;
        const lon = flight.longitude + (arr.longitude - flight.longitude) * t;
        let altM: number;
        if (t < descentStartFrac) {
          altM = cruiseAltM;
        } else {
          const dt = (t - descentStartFrac) / (1 - descentStartFrac);
          altM = cruiseAltM * (1 - dt);
        }
        projectedPoints.push({
          distKm: currentDist + totalToArr * t,
          altFt: Math.max(0, altM / FT_TO_M),
          lon,
          lat,
        });
      }
    }

    const totalDist = projectedPoints.length > 0
      ? projectedPoints[projectedPoints.length - 1].distKm
      : currentDist;

    const sigBands: { minFt: number; maxFt: number; startKm: number; endKm: number; hazard: string }[] = [];
    for (const sig of sigmets) {
      if (sig.points.length < 3) continue;
      let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const [lon, lat] of sig.points) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      const sigCenterLon = (minLon + maxLon) / 2;
      const sigCenterLat = (minLat + maxLat) / 2;
      const distToSig = haversineKm(flight.longitude, flight.latitude, sigCenterLon, sigCenterLat);
      const sigWidthKm = haversineKm(minLon, sigCenterLat, maxLon, sigCenterLat);
      if (distToSig > totalDist + 200) continue;
      sigBands.push({
        minFt: sig.min_ft ?? 0,
        maxFt: sig.max_ft ?? MAX_ALT_FT,
        startKm: Math.max(currentDist * 0.3, distToSig - sigWidthKm / 2),
        endKm: Math.min(totalDist, distToSig + sigWidthKm / 2),
        hazard: sig.hazard_type,
      });
    }

    return { trailPoints, projectedPoints, sigBands, totalDist, currentDist, currentAltFt };
  }, [flight, route, trail, sigmets]);

  if (!flight || !data) return null;

  const width = 100;
  const height = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const maxDist = Math.max(data.totalDist, 1);

  const xScale = (km: number) =>
    CHART_PADDING.left + (km / maxDist) * (width - CHART_PADDING.left - CHART_PADDING.right);
  const yScale = (ft: number) =>
    CHART_PADDING.top + (1 - Math.min(ft, MAX_ALT_FT) / MAX_ALT_FT) * height;

  const trailPath = data.trailPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.distKm).toFixed(1)} ${yScale(p.altFt).toFixed(1)}`)
    .join(" ");

  const projectedPath = data.projectedPoints.length > 0
    ? `M ${xScale(data.currentDist).toFixed(1)} ${yScale(data.currentAltFt).toFixed(1)} ` +
      data.projectedPoints
        .map((p) => `L ${xScale(p.distKm).toFixed(1)} ${yScale(p.altFt).toFixed(1)}`)
        .join(" ")
    : "";

  const gridLines = [0, 10000, 20000, 30000, 40000];

  return (
    <div className="absolute bottom-20 left-1/2 z-30 w-[min(95vw,900px)] -translate-x-1/2 border border-hud-border bg-hud-charcoal/95 backdrop-blur-md sm:bottom-24">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between border-b border-hud-border px-3 py-1.5"
      >
        <div className="flex items-center gap-1.5">
          <Mountain className="size-3 text-hud-grid" />
          <span className="font-mono text-[14px] font-bold tracking-[0.16em] text-hud-grid">
            VERTICAL PROFILE
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="size-3.5 text-hud-dim" />
        ) : (
          <ChevronUp className="size-3.5 text-hud-dim" />
        )}
      </button>

      {expanded && (
        <div className="relative p-2">
          <svg
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="h-[140px] w-full"
          >
            {gridLines.map((ft) => (
              <g key={ft}>
                <line
                  x1={CHART_PADDING.left}
                  y1={yScale(ft)}
                  x2={width - CHART_PADDING.right}
                  y2={yScale(ft)}
                  stroke="rgba(57,255,20,0.08)"
                  strokeWidth="0.3"
                />
                <text
                  x={width - CHART_PADDING.right + 1}
                  y={yScale(ft) + 2}
                  fill="#5a6770"
                  fontSize="5"
                  fontFamily="ui-monospace, monospace"
                >
                  FL{ft / 100}
                </text>
              </g>
            ))}

            {data.sigBands.map((band, i) => {
              const x = xScale(band.startKm);
              const w = xScale(band.endKm) - x;
              const y = yScale(band.maxFt);
              const h = yScale(band.minFt) - y;
              if (w <= 0 || h <= 0) return null;
              return (
                <g key={`sig-${i}`}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="#ff5f1f"
                    fillOpacity="0.12"
                    stroke="#ff5f1f"
                    strokeOpacity="0.4"
                    strokeWidth="0.3"
                  />
                  <text
                    x={x + w / 2}
                    y={y - 1}
                    fill="#ff5f1f"
                    fontSize="4"
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                  >
                    {band.hazard.slice(0, 4)}
                  </text>
                </g>
              );
            })}

            {trailPath && (
              <path
                d={trailPath}
                fill="none"
                stroke="#39ff14"
                strokeWidth="0.8"
                strokeOpacity="0.8"
              />
            )}

            {projectedPath && (
              <path
                d={projectedPath}
                fill="none"
                stroke="#39ff14"
                strokeWidth="0.6"
                strokeOpacity="0.4"
                strokeDasharray="2,1.5"
              />
            )}

            {data.sigBands.length > 0 && (
              <g transform={`translate(${CHART_PADDING.left}, ${CHART_HEIGHT - 8})`}>
                <TriangleAlert className="hidden" x={0} y={0} width={0} height={0} />
                <text
                  fill="#ff5f1f"
                  fontSize="4"
                  fontFamily="ui-monospace, monospace"
                  opacity="0.6"
                >
                  {data.sigBands.length} HAZARD BANDS
                </text>
              </g>
            )}

            <circle
              cx={xScale(data.currentDist)}
              cy={yScale(data.currentAltFt)}
              r="1.2"
              fill="#39ff14"
            />
          </svg>

          <div className="flex items-center justify-between px-1 pt-1 font-mono text-[13px] text-hud-dim">
            <span>0 km</span>
            <span className="text-hud-grid">
              CUR: FL{Math.round(data.currentAltFt / 100)}
            </span>
            <span>{Math.round(maxDist)} km</span>
          </div>
        </div>
      )}
    </div>
  );
}
