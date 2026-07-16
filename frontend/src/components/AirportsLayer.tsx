import { Entity, PointGraphics } from "resium";
import {
  Cartesian3,
  Cartesian2,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  DistanceDisplayCondition,
} from "cesium";
import type { Airport } from "@/types/domain";

interface AirportsLayerProps {
  airports: Airport[];
}

const RING_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.25);
const CORE_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.7);
const LABEL_FILL = Color.fromCssColorString("#b8c4cc").withAlpha(0.7);
const LABEL_OUTLINE = Color.fromCssColorString("#08080a").withAlpha(0.85);
const LABEL_BG = Color.fromCssColorString("#08080a").withAlpha(0.5);
const TRACK_BG = Color.fromCssColorString("#08080a").withAlpha(0.8);

const LABEL_OFFSET = new Cartesian2(12, -8);
const LABEL_PADDING = new Cartesian2(3, 1);

const LABEL_NEAR_FAR = { near: 0, far: 4_000_000 } as const;
const POINT_NEAR_FAR = { near: 0, far: 8_000_000 } as const;

export function AirportsLayer({ airports }: AirportsLayerProps) {
  return (
    <>
      {airports.map((apt) => {
        const position = Cartesian3.fromDegrees(
          apt.longitude,
          apt.latitude,
          50,
        );

        return (
          <Entity
            key={apt.icao}
            position={position}
            id={`APT-${apt.icao}`}
            name={`APT ${apt.icao} ${apt.name}`}
          >
            <PointGraphics
              pixelSize={12}
              color={Color.TRANSPARENT}
              outlineColor={RING_COLOR}
              outlineWidth={1}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
              heightReference={HeightReference.NONE}
              distanceDisplayCondition={new DistanceDisplayCondition(
                POINT_NEAR_FAR.near,
                POINT_NEAR_FAR.far,
              )}
            />
          </Entity>
        );
      })}
      {airports.map((apt) => (
        <Entity
          key={`${apt.icao}-core`}
          position={Cartesian3.fromDegrees(apt.longitude, apt.latitude, 50)}
        >
          <PointGraphics
            pixelSize={3}
            color={CORE_COLOR}
            outlineColor={TRACK_BG}
            outlineWidth={1}
            disableDepthTestDistance={Number.POSITIVE_INFINITY}
            heightReference={HeightReference.NONE}
            distanceDisplayCondition={new DistanceDisplayCondition(
              POINT_NEAR_FAR.near,
              POINT_NEAR_FAR.far,
            )}
          />
        </Entity>
      ))}
      {airports.map((apt) => {
        const position = Cartesian3.fromDegrees(
          apt.longitude,
          apt.latitude,
          50,
        );
        const label = apt.iata ?? apt.icao;

        return (
          <Entity
            key={`${apt.icao}-label`}
            position={position}
            label={{
              text: label,
              font: '9px "JetBrains Mono", ui-monospace, monospace',
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
            }}
          />
        );
      })}
    </>
  );
}
