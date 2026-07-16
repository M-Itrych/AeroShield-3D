import { Entity, PolylineGraphics, LabelGraphics } from "resium";
import {
  Cartesian3,
  Cartesian2,
  Color,
  PolylineDashMaterialProperty,
  ArcType,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  DistanceDisplayCondition,
} from "cesium";
import type {
  FlightVector,
  HazardPolygon,
  FlightRoute,
  RiskAssessment,
} from "@/types/domain";
import { computeRerouteOptions } from "@/lib/reroute-utils";

interface RerouteLayerProps {
  flight: FlightVector | null;
  route: FlightRoute | null;
  sigmets: HazardPolygon[];
  risk: RiskAssessment | null;
}

const DETOUR_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.8);
const DETOUR_DASH_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.3);
const LABEL_FILL = Color.fromCssColorString("#39ff14").withAlpha(0.95);
const LABEL_OUTLINE = Color.fromCssColorString("#08080a").withAlpha(0.9);
const LABEL_BG = Color.fromCssColorString("#08080a").withAlpha(0.6);
const LABEL_OFFSET = new Cartesian2(10, -8);
const NEAR_FAR = { near: 0, far: 10_000_000 } as const;

export function RerouteLayer({ flight, route, sigmets, risk }: RerouteLayerProps) {
  if (!flight || !risk || risk.risk !== "HIGH" || !risk.sigmet_id) return null;

  const options = computeRerouteOptions(
    flight,
    route,
    sigmets,
    risk.sigmet_id,
  );

  if (options.length === 0) return null;

  const entities: React.ReactNode[] = [];

  for (const opt of options) {
    const coords: number[] = [];
    for (const wp of opt.waypoints) {
      coords.push(wp.lon, wp.lat, wp.alt_m);
    }

    entities.push(
      <Entity
        key={`reroute-${opt.id}`}
        name={`DETOUR ${opt.side} +${Math.round(opt.extra_km)}km +${Math.ceil(opt.extra_min)}min`}
      >
        <PolylineGraphics
          positions={Cartesian3.fromDegreesArrayHeights(coords)}
          width={2}
          material={
            new PolylineDashMaterialProperty({
              color: DETOUR_COLOR,
              gapColor: DETOUR_DASH_COLOR,
              dashLength: 12,
            })
          }
          arcType={ArcType.NONE}
          distanceDisplayCondition={new DistanceDisplayCondition(
            NEAR_FAR.near,
            NEAR_FAR.far,
          )}
        />
      </Entity>,
    );

    const labelPoint = opt.waypoints[1];
    entities.push(
      <Entity
        key={`reroute-label-${opt.id}`}
        position={Cartesian3.fromDegrees(
          labelPoint.lon,
          labelPoint.lat,
          labelPoint.alt_m,
        )}
      >
        <LabelGraphics
          text={`${opt.side.slice(0, 1)} +${Math.round(opt.extra_km)}KM`}
          font='9px "JetBrains Mono", ui-monospace, monospace'
          fillColor={LABEL_FILL}
          outlineColor={LABEL_OUTLINE}
          outlineWidth={2}
          style={LabelStyle.FILL_AND_OUTLINE}
          verticalOrigin={VerticalOrigin.CENTER}
          horizontalOrigin={HorizontalOrigin.LEFT}
          pixelOffset={LABEL_OFFSET}
          showBackground
          backgroundColor={LABEL_BG}
          backgroundPadding={new Cartesian2(3, 2)}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
          heightReference={HeightReference.NONE}
          distanceDisplayCondition={new DistanceDisplayCondition(
            NEAR_FAR.near,
            NEAR_FAR.far,
          )}
        />
      </Entity>,
    );
  }

  return <>{entities}</>;
}
