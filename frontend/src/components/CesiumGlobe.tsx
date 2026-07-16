import { useEffect, useRef, type ReactNode } from "react";
import { Viewer as ResiumViewer } from "resium";
import type { CesiumComponentRef } from "resium";
import type { Viewer as CesiumViewer } from "cesium";

interface CesiumGlobeProps {
  children?: ReactNode;
  onReady?: (viewer: CesiumViewer) => void;
}

export function CesiumGlobe({ children, onReady }: CesiumGlobeProps) {
  const viewerRef = useRef<CesiumViewer | null>(null);

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
            onReady?.(el);
          }
        }}
      >
        {children}
      </ResiumViewer>
    </div>
  );
}
