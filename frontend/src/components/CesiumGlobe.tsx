import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Viewer as ResiumViewer, ImageryLayer } from "resium";
import type { CesiumComponentRef } from "resium";
import {
  type Viewer as CesiumViewer,
  Color,
  UrlTemplateImageryProvider,
} from "cesium";

interface CesiumGlobeProps {
  children?: ReactNode;
  onReady?: (viewer: CesiumViewer) => void;
}

const GLOBE_BASE_COLOR = Color.fromCssColorString("#121315");
const CONTINENT_COLOR = Color.fromCssColorString("#1c1d21");

const darkImageryProvider = new UrlTemplateImageryProvider({
  url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  credit: "CARTO",
  maximumLevel: 18,
});

const labelsImageryProvider = new UrlTemplateImageryProvider({
  url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  credit: "CARTO",
  minimumLevel: 0,
  maximumLevel: 6,
});

function tuneViewer(viewer: CesiumViewer) {
  const scene = viewer.scene;

  scene.postProcessStages.ambientOcclusion.enabled = false;
  scene.postProcessStages.bloom.enabled = false;
  scene.globe.showGroundAtmosphere = false;
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
  if (scene.skyBox) scene.skyBox.show = false;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  scene.fog.enabled = false;
  scene.shadowMap.enabled = false;
  scene.highDynamicRange = false;
  scene.backgroundColor = Color.fromCssColorString("#08080a");

  const globe = scene.globe;
  globe.depthTestAgainstTerrain = false;
  globe.maximumScreenSpaceError = 2;
  globe.baseColor = GLOBE_BASE_COLOR;
  globe.showWaterEffect = false;

  const sscc = scene.screenSpaceCameraController;
  sscc.enableTilt = true;
  sscc.minimumZoomDistance = 100;
  sscc.maximumZoomDistance = 40_000_000;
}

export function CesiumGlobe({ children, onReady }: CesiumGlobeProps) {
  const viewerRef = useRef<CesiumViewer | null>(null);

  const baseProvider = useMemo(() => darkImageryProvider, []);
  const labelsProvider = useMemo(() => labelsImageryProvider, []);

  useEffect(() => {
    return () => {
      viewerRef.current?.destroy?.();
    };
  }, []);

  return (
    <div className="cesium-container">
      <ResiumViewer
        full
        baseLayerPicker={false}
        fullscreenButton={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        homeButton={false}
        geocoder={false}
        animation={false}
        timeline={false}
        selectionIndicator={false}
        infoBox={false}
        ref={(r: CesiumComponentRef<CesiumViewer> | null) => {
          const el = r?.cesiumElement;
          if (el) {
            viewerRef.current = el;
            tuneViewer(el);
            onReady?.(el);
          }
        }}
      >
        <ImageryLayer imageryProvider={baseProvider} />
        <ImageryLayer imageryProvider={labelsProvider} />
        {children}
      </ResiumViewer>
    </div>
  );
}

export { CONTINENT_COLOR };

