import { Plane, TriangleAlert, Route, Spline, Map, RotateCw, Home, TowerControl } from "lucide-react";

export interface LayerVisibility {
  flights: boolean;
  sigmets: boolean;
  trails: boolean;
  routes: boolean;
  airports: boolean;
}

interface GlobeControlBarProps {
  layers: LayerVisibility;
  onLayersChange: (layers: LayerVisibility) => void;
  onResetView: () => void;
  sceneMode: "3D" | "2D";
  onToggleSceneMode: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
}

const LAYER_BUTTONS = [
  { key: "flights" as const, label: "TRACKS", Icon: Plane },
  { key: "airports" as const, label: "AIRPRT", Icon: TowerControl },
  { key: "sigmets" as const, label: "HAZARDS", Icon: TriangleAlert },
  { key: "trails" as const, label: "TRAILS", Icon: Spline },
  { key: "routes" as const, label: "ROUTES", Icon: Route },
];

export function GlobeControlBar({
  layers,
  onLayersChange,
  onResetView,
  sceneMode,
  onToggleSceneMode,
  autoRotate,
  onToggleAutoRotate,
}: GlobeControlBarProps) {
  return (
    <div className="absolute bottom-3 left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 flex-col gap-1.5 border border-hud-grid/20 bg-hud-charcoal/95 p-2 backdrop-blur-md sm:bottom-4 sm:right-4 sm:left-auto sm:translate-x-0 sm:flex-col sm:p-3">
      <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-start">
        <span className="font-mono text-[8px] tracking-[0.16em] text-hud-dim">LAYERS</span>
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-2 sm:gap-1.5">
          {LAYER_BUTTONS.map(({ key, label, Icon }) => {
            const active = layers[key];
            const isHazard = key === "sigmets";
            return (
              <button
                key={key}
                onClick={() => onLayersChange({ ...layers, [key]: !active })}
                className={`flex items-center gap-1 border px-1.5 py-1 font-mono text-[8px] tracking-wider transition-colors ${
                  active
                    ? isHazard
                      ? "border-hud-warn bg-hud-warn/10 text-hud-warn"
                      : "border-hud-grid bg-hud-grid/10 text-hud-grid"
                    : "border-hud-grid/15 text-hud-dim hover:border-hud-grid/40"
                }`}
              >
                <Icon className={`size-3 ${active ? "" : "opacity-40"}`} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden h-px bg-hud-grid/15 sm:block" />

      <div className="flex items-center gap-1">
        <button
          onClick={onResetView}
          className="flex items-center gap-1 border border-hud-grid/20 px-2 py-1 font-mono text-[8px] tracking-wider text-hud-dim transition-colors hover:border-hud-grid hover:text-hud-grid"
        >
          <Home className="size-3" />
          <span className="hidden sm:inline">RESET</span>
        </button>
        <button
          onClick={onToggleSceneMode}
          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[8px] tracking-wider transition-colors ${
            sceneMode === "2D"
              ? "border-hud-grid bg-hud-grid/10 text-hud-grid"
              : "border-hud-grid/15 text-hud-dim hover:border-hud-grid/40"
          }`}
        >
          <Map className="size-3" />
          {sceneMode}
        </button>
        <button
          onClick={onToggleAutoRotate}
          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[8px] tracking-wider transition-colors ${
            autoRotate
              ? "border-hud-grid bg-hud-grid/10 text-hud-grid"
              : "border-hud-grid/15 text-hud-dim hover:border-hud-grid/40"
          }`}
        >
          <RotateCw className={`size-3 ${autoRotate ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">ROTATE</span>
        </button>
      </div>
    </div>
  );
}
