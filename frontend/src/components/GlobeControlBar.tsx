import { Plane, TriangleAlert, Route, Spline, TowerControl, Map, RotateCw, Home } from "lucide-react";

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

const BTN_BASE =
  "flex items-center gap-1 border px-2 py-1 font-mono text-[10px] tracking-wider transition-colors active:scale-[0.96]";

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
    <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-stretch gap-1.5 border border-hud-border bg-hud-charcoal/95 p-1.5 backdrop-blur-md sm:bottom-2">
      <span className="flex items-center px-1 font-mono text-[10px] tracking-[0.16em] text-hud-dim">
        LAYERS
      </span>

      {LAYER_BUTTONS.map(({ key, label, Icon }) => {
        const active = layers[key];
        const isHazard = key === "sigmets";
        return (
          <button
            key={key}
            onClick={() => onLayersChange({ ...layers, [key]: !active })}
            aria-pressed={active}
            className={`${BTN_BASE} ${
              active
                ? isHazard
                  ? "border-hud-warn bg-hud-warn/10 text-hud-warn"
                  : "border-hud-grid bg-hud-grid/10 text-hud-grid"
                : "border-hud-border text-hud-dim hover:border-hud-grid/40"
            }`}
          >
            <Icon className={`size-3.5 ${active ? "" : "opacity-40"}`} />
            <span>{label}</span>
          </button>
        );
      })}

      <span className="flex items-center px-1 font-mono text-[10px] tracking-[0.16em] text-hud-dim">
        VIEW
      </span>

      <button
        onClick={onResetView}
        className={`${BTN_BASE} border-hud-border text-hud-dim hover:border-hud-grid hover:text-hud-grid`}
      >
        <Home className="size-3.5" />
        <span>RESET</span>
      </button>
      <button
        onClick={onToggleSceneMode}
        className={`${BTN_BASE} ${
          sceneMode === "2D"
            ? "border-hud-grid bg-hud-grid/10 text-hud-grid"
            : "border-hud-border text-hud-dim hover:border-hud-grid/40"
        }`}
      >
        <Map className="size-3.5" />
        {sceneMode}
      </button>
      <button
        onClick={onToggleAutoRotate}
        className={`${BTN_BASE} ${
          autoRotate
            ? "border-hud-grid bg-hud-grid/10 text-hud-grid"
            : "border-hud-border text-hud-dim hover:border-hud-grid/40"
        }`}
      >
        <RotateCw className={`size-3.5 ${autoRotate ? "animate-spin" : ""}`} />
        <span>ROTATE</span>
      </button>
    </div>
  );
}
