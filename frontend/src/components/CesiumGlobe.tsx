import { useEffect, useRef, useState, type ReactNode } from "react";
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

type Theme = "dark" | "light";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

const THEME_COLORS: Record<Theme, { base: Color; bg: Color }> = {
  dark: {
    base: Color.fromCssColorString("#121315"),
    bg: Color.fromCssColorString("#0b0c0e"),
  },
  light: {
    base: Color.fromCssColorString("#e9ebee"),
    bg: Color.fromCssColorString("#fafafa"),
  },
};

const darkBase = new UrlTemplateImageryProvider({
  url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  credit: "CARTO",
  maximumLevel: 18,
});

const darkLabels = new UrlTemplateImageryProvider({
  url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  credit: "CARTO",
  minimumLevel: 0,
  maximumLevel: 6,
});

const lightBase = new UrlTemplateImageryProvider({
  url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  credit: "CARTO",
  maximumLevel: 18,
});

const lightLabels = new UrlTemplateImageryProvider({
  url: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png",
  subdomains: ["a", "b", "c", "d"],
  credit: "CARTO",
  minimumLevel: 0,
  maximumLevel: 6,
});

function tuneViewer(viewer: CesiumViewer, theme: Theme) {
  const scene = viewer.scene;
  const colors = THEME_COLORS[theme];

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
  scene.backgroundColor = colors.bg;

  const globe = scene.globe;
  globe.depthTestAgainstTerrain = false;
  globe.maximumScreenSpaceError = 2;
  globe.baseColor = colors.base;
  globe.showWaterEffect = false;

  const sscc = scene.screenSpaceCameraController;
  sscc.enableTilt = true;
  sscc.minimumZoomDistance = 100;
  sscc.maximumZoomDistance = 40_000_000;
}

export function CesiumGlobe({ children, onReady }: CesiumGlobeProps) {
  const viewerRef = useRef<CesiumViewer | null>(null);
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const baseProvider = theme === "dark" ? darkBase : lightBase;
  const labelsProvider = theme === "dark" ? darkLabels : lightLabels;

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer) tuneViewer(viewer, theme);
  }, [theme]);

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
            tuneViewer(el, currentTheme());
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

export { THEME_COLORS };

