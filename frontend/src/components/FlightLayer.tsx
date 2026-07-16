import { Entity, CustomDataSource } from "resium";
import { Cartesian3, Color, Math as CesiumMath } from "cesium";
import type { FlightVector, RiskAssessment } from "@/types/domain";

interface FlightLayerProps {
  flights: FlightVector[];
  risks?: RiskAssessment[];
  onSelect?: (icao24: string) => void;
}

const RISK_COLOR: Record<string, Color> = {
  HIGH: Color.fromCssColorString("#ff3358").withAlpha(0.95),
  MEDIUM: Color.fromCssColorString("#ffaa00").withAlpha(0.9),
  NONE: Color.fromCssColorString("#f5d091").withAlpha(0.8),
};

function getRiskColor(icao24: string, risks?: RiskAssessment[]): Color {
  if (!risks) return RISK_COLOR.NONE;
  const r = risks.find((x) => x.flight === icao24);
  return r ? RISK_COLOR[r.risk] : RISK_COLOR.NONE;
}

function getPixelSize(icao24: string, risks?: RiskAssessment[]): number {
  if (!risks) return 8;
  const r = risks.find((x) => x.flight === icao24);
  if (!r) return 8;
  return r.risk === "HIGH" ? 14 : r.risk === "MEDIUM" ? 11 : 8;
}

export function FlightLayer({ flights, risks }: FlightLayerProps) {
  return (
    <CustomDataSource name="flights">
      {flights.map((f) => {
        const alt = f.baro_altitude ?? 10000;
        const position = Cartesian3.fromDegrees(
          f.longitude,
          f.latitude,
          alt,
        );
        const color = getRiskColor(f.icao24, risks);
        const size = getPixelSize(f.icao24, risks);
        const rotation = f.heading
          ? CesiumMath.toRadians(-f.heading)
          : 0;

        return (
          <Entity
            key={f.icao24}
            position={position}
            name={f.callsign ?? f.icao24}
            point={{
              pixelSize: size,
              color,
              outlineColor: color.withAlpha(0.4),
              outlineWidth: 2,
              scaleByDistance: undefined,
              translucencyByDistance: undefined,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }}
            billboard={{
              rotation,
              scale: 0.6,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }}
          />
        );
      })}
    </CustomDataSource>
  );
}
