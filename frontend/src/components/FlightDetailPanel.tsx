import { useState } from "react";
import { X, Crosshair, Navigation, Gauge, Mountain, Globe2, Plane, Radio, MapPin } from "lucide-react";
import type { FlightVector, FlightRoute, RiskAssessment } from "@/types/domain";
import { useFlightRegion } from "@/hooks/use-flight-region";

interface FlightDetailPanelProps {
  flight: FlightVector | null;
  route?: FlightRoute | null;
  risk?: RiskAssessment;
  onClose?: () => void;
  onFollow?: () => void;
  followMode?: boolean;
}

export function FlightDetailPanel({
  flight,
  route,
  risk,
  onClose,
  onFollow,
  followMode,
}: FlightDetailPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const regionQuery = useFlightRegion(
    flight?.latitude ?? null,
    flight?.longitude ?? null,
    flight?.icao24 ?? null,
  );

  if (!flight) return null;

  const altFt = flight.baro_altitude ? Math.round(flight.baro_altitude * 3.28084) : null;
  const velocityKt = flight.velocity ? Math.round(flight.velocity * 1.94384) : null;
  const velocityKmh = flight.velocity ? Math.round(flight.velocity * 3.6) : null;
  const headingDeg = flight.heading != null ? Math.round(flight.heading) : null;

  const region = regionQuery.data?.country ?? null;
  const regionState = regionQuery.data?.state ?? null;

  const riskLevel = risk?.risk ?? "NONE";
  const isHigh = riskLevel === "HIGH";
  const isWarn = riskLevel === "HIGH" || riskLevel === "MEDIUM";

  const cs = flight.callsign?.trim() || flight.icao24;
  const suffix = flight.icao24.slice(-4).toUpperCase();

  return (
    <div className="absolute right-[18rem] top-12 z-30 w-72 border border-hud-grid/25 bg-hud-charcoal/95 backdrop-blur-md sm:w-80">
      <div className="flex items-center justify-between border-b border-hud-grid/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Crosshair className={`size-3 ${isWarn ? "text-hud-warn" : "text-hud-grid"}`} />
          <span className={`font-mono text-[11px] font-bold tracking-wider ${isWarn ? "text-hud-warn" : "text-hud-grid"}`}>
            {cs} {suffix}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onFollow}
            className={`border px-2 py-0.5 font-mono text-[9px] tracking-wider transition-colors ${
              followMode
                ? "border-hud-grid bg-hud-grid/15 text-hud-grid"
                : "border-hud-grid/25 text-hud-dim hover:border-hud-grid/50"
            }`}
          >
            {followMode ? "LOCK" : "FOLLOW"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-hud-dim transition-colors hover:text-hud-grid"
          >
            <span className="font-mono text-[9px]">{expanded ? "[-]" : "[+]"}</span>
          </button>
          <button
            onClick={onClose}
            className="text-hud-dim transition-colors hover:text-hud-warn"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-0">
          <StatRow icon={Radio} label="ICAO24" value={flight.icao24.toUpperCase()} />
          <StatRow icon={Plane} label="CALLSIGN" value={cs} />
          <StatRow
            icon={Globe2}
            label="REGISTRY"
            value={flight.origin_country}
          />
          <StatRow
            icon={MapPin}
            label="REGION"
            value={
              region
                ? regionState
                  ? `${region} / ${regionState}`
                  : region
                : regionQuery.isLoading
                  ? "..."
                  : "---"
            }
          />
          <StatRow
            icon={Mountain}
            label="ALTITUDE"
            value={altFt != null ? `${altFt.toLocaleString()} ft` : "---"}
            accent={isWarn ? "warn" : altFt != null && altFt > 30000 ? "warn" : "ink"}
          />
          <StatRow
            icon={Gauge}
            label="VELOCITY"
            value={
              velocityKt != null
                ? `${velocityKt} kt / ${velocityKmh} km/h`
                : "---"
            }
          />
          <StatRow
            icon={Navigation}
            label="HEADING"
            value={headingDeg != null ? `${headingDeg}°` : "---"}
          />
          <StatRow
            icon={MapPin}
            label="POSITION"
            value={`${flight.latitude.toFixed(3)}, ${flight.longitude.toFixed(3)}`}
          />
          <StatRow
            icon={Crosshair}
            label="STATUS"
            value={flight.on_ground ? "ON GROUND" : "AIRBORNE"}
            accent={flight.on_ground ? "dim" : "grid"}
          />
          <StatRow
            icon={Crosshair}
            label="RISK"
            value={riskLevel}
            accent={isHigh ? "warn" : isWarn ? "warn" : "grid"}
          />

          {route && (route.departure || route.arrival) && (
            <div className="border-t border-hud-grid/15 px-3 py-2">
              <div className="mb-1 font-mono text-[8px] tracking-[0.16em] text-hud-dim">
                ROUTE
              </div>
              <div className="font-mono text-[10px] text-hud-ink">
                <span className="text-hud-grid">
                  {route.departure_airport?.iata ?? route.departure ?? "---"}
                </span>
                {" -> "}
                <span className="text-hud-warn">
                  {route.arrival_airport?.iata ?? route.arrival ?? "---"}
                </span>
              </div>
              {route.departure_airport && (
                <div className="mt-1 font-mono text-[9px] text-hud-dim">
                  DEP: {route.departure_airport.name}
                </div>
              )}
              {route.arrival_airport && (
                <div className="font-mono text-[9px] text-hud-dim">
                  ARR: {route.arrival_airport.name}
                </div>
              )}
            </div>
          )}

          {risk?.sigmet_id && (
            <div className="border-t border-hud-grid/15 px-3 py-2">
              <div className="font-mono text-[9px] text-hud-warn">
                SIGMET: {risk.sigmet_id}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  accent = "ink",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "ink" | "grid" | "warn" | "dim";
}) {
  const colorClass =
    accent === "warn"
      ? "text-hud-warn"
      : accent === "grid"
        ? "text-hud-grid"
        : accent === "dim"
          ? "text-hud-dim"
          : "text-hud-ink";
  return (
    <div className="flex items-center justify-between border-b border-hud-grid/8 px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="size-2.5 text-hud-dim" />
        <span className="font-mono text-[8px] tracking-[0.14em] text-hud-dim">
          {label}
        </span>
      </div>
      <span className={`font-mono text-[10px] font-medium ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}
