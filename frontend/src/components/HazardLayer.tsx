import { Entity } from "resium";
import {
  Cartesian3,
  Color,
  PolygonHierarchy,
  ColorMaterialProperty,
  HeightReference,
  ArcType,
} from "cesium";
import type { HazardPolygon } from "@/types/domain";

interface HazardLayerProps {
  sigmets: HazardPolygon[];
}

const HAZARD_FILL = Color.fromCssColorString("#ff5f1f").withAlpha(0.12);
const HAZARD_OUTLINE = Color.fromCssColorString("#ff5f1f").withAlpha(0.7);

export function HazardLayer({ sigmets }: HazardLayerProps) {
  return (
    <>
      {sigmets.map((sig) => {
        const coords: number[] = [];
        for (const [lon, lat] of sig.points) {
          coords.push(lon, lat);
        }

        const hierarchy = new PolygonHierarchy(
          Cartesian3.fromDegreesArray(coords),
        );

        return (
          <Entity
            key={sig.sigmet_id}
            id={sig.sigmet_id}
            name={`SIGMET ${sig.sigmet_id} (${sig.hazard_type})`}
            polygon={{
              hierarchy,
              material: new ColorMaterialProperty(HAZARD_FILL),
              outline: true,
              outlineColor: HAZARD_OUTLINE,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              fill: true,
              arcType: ArcType.GEODESIC,
            }}
          />
        );
      })}
    </>
  );
}
