import { useEffect, useRef } from "react";
import {
  Cartesian3,
  Cartesian2,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  type Viewer as CesiumViewer,
  PointPrimitiveCollection,
  LabelCollection,
  DistanceDisplayCondition,
} from "cesium";
import type { Airport } from "@/types/domain";

interface AirportsLayerProps {
  airports: Airport[];
  viewer?: CesiumViewer | null;
}

const RING_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.25);
const CORE_COLOR = Color.fromCssColorString("#39ff14").withAlpha(0.7);
const LABEL_FILL = Color.fromCssColorString("#b8c4cc").withAlpha(0.7);
const LABEL_OUTLINE = Color.fromCssColorString("#08080a").withAlpha(0.85);
const LABEL_BG = Color.fromCssColorString("#08080a").withAlpha(0.5);
const TRACK_BG = Color.fromCssColorString("#08080a").withAlpha(0.8);

const LABEL_OFFSET = new Cartesian2(12, -8);
const LABEL_PADDING = new Cartesian2(3, 1);

const LABEL_NEAR_FAR = new DistanceDisplayCondition(0, 4_000_000);
const POINT_NEAR_FAR = new DistanceDisplayCondition(0, 8_000_000);

export function AirportsLayer({ airports, viewer }: AirportsLayerProps) {
  const pointsRef = useRef<PointPrimitiveCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);

  useEffect(() => {
    if (!viewer) return;

    const points = new PointPrimitiveCollection();
    const labels = new LabelCollection();
    viewer.scene.primitives.add(points);
    viewer.scene.primitives.add(labels);
    pointsRef.current = points;
    labelsRef.current = labels;

    return () => {
      viewer.scene.primitives.remove(points);
      viewer.scene.primitives.remove(labels);
      pointsRef.current = null;
      labelsRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const points = pointsRef.current;
    const labels = labelsRef.current;
    if (!points || !labels) return;

    points.removeAll();
    labels.removeAll();

    for (const apt of airports) {
      const pos = Cartesian3.fromDegrees(apt.longitude, apt.latitude, 50);

      const ring = points.add({
        position: pos,
        pixelSize: 12,
        color: Color.TRANSPARENT,
        outlineColor: RING_COLOR,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: POINT_NEAR_FAR,
      });
      void ring;

      points.add({
        position: pos,
        pixelSize: 3,
        color: CORE_COLOR,
        outlineColor: TRACK_BG,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: POINT_NEAR_FAR,
      });

      labels.add({
        position: pos,
        text: apt.iata ?? apt.icao,
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
        distanceDisplayCondition: LABEL_NEAR_FAR,
      });
    }
  }, [airports, viewer]);

  return null;
}
