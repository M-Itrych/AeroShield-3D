import { Entity } from "resium";
import { Cartesian3, Color, PolygonHierarchy, ConstantProperty } from "cesium";
import type { HazardPolygon } from "@/types/domain";

interface HazardLayerProps {
  sigmets: HazardPolygon[];
}

const HAZARD_COLOR = Color.fromCssColorString("#ff3358").withAlpha(0.18);
const HAZARD_OUTLINE = Color.fromCssColorString("#ff3358").withAlpha(0.5);

function ftToM(ft: number): number {
  return ft * 0.3048;
}

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

        const minAlt = sig.min_ft ? ftToM(sig.min_ft) : 0;
        const maxAlt = sig.max_ft ? ftToM(sig.max_ft) : 15000;

        return (
          <Entity
            key={sig.sigmet_id}
            name={sig.hazard_type}
            polygon={
              {
                hierarchy: new ConstantProperty(hierarchy),
                material: new ConstantProperty(HAZARD_COLOR),
                outline: new ConstantProperty(true),
                outlineColor: new ConstantProperty(HAZARD_OUTLINE),
                extrudedHeight: new ConstantProperty(maxAlt),
                height: new ConstantProperty(minAlt),
                fill: new ConstantProperty(true),
              } as unknown as React.ComponentProps<typeof Entity>["polygon"]
            }
          />
        );
      })}
    </>
  );
}
