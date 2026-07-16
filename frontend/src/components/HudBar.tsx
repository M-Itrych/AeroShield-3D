import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LegendDialog } from "@/components/LegendDialog";
import type { RiskConnectionState } from "@/hooks/use-risk-stream";

interface HudBarProps {
  flightCount: number;
  sigmetCount: number;
  highRiskCount?: number;
  riskConnectionState?: RiskConnectionState;
}

export function HudBar({
  flightCount,
  sigmetCount,
  highRiskCount,
  riskConnectionState = "open",
}: HudBarProps) {
  const [utc, setUtc] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      const s = String(d.getUTCSeconds()).padStart(2, "0");
      setUtc(`${h}:${m}:${s}Z`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="absolute left-0 right-0 top-0 z-40 flex h-9 items-center justify-between border-b border-hud-border bg-hud-space/90 px-2 backdrop-blur-md sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full border border-hud-grid/70" />
            <span className="relative inline-flex size-2 rounded-full bg-hud-grid" />
          </span>
          <span className="font-mono text-[13px] font-bold tracking-[0.16em] text-hud-grid sm:text-xs">
            AEROSHIELD
          </span>
          <span className="ml-1 hidden font-mono text-[14px] tracking-[0.2em] text-hud-dim sm:inline">
            TACTICAL TELEMETRY
          </span>
        </div>
        <StreamStatus state={riskConnectionState} />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1 border border-hud-border bg-hud-charcoal/60 px-2 py-1 font-mono text-[14px] tracking-wider text-hud-dim transition-colors hover:text-hud-grid active:scale-[0.96]"
          aria-label="Open field guide"
        >
          <CircleHelp className="size-3" />
          <span className="hidden sm:inline">GUIDE</span>
        </button>
        <Stat label="TRACKS" value={flightCount} />
        <span className="h-3 w-px bg-hud-border" />
        <Stat label="HAZARDS" value={sigmetCount} color="text-hud-warn" />
        {highRiskCount !== undefined && highRiskCount > 0 && (
          <>
            <span className="h-3 w-px bg-hud-border" />
            <Badge variant="destructive" className="font-mono text-[14px]">
              {highRiskCount} CRIT
            </Badge>
          </>
        )}
        <span className="h-3 w-px bg-hud-border" />
        <span className="font-mono text-[12px] tabular-nums tracking-wider text-hud-ink sm:text-xs">
          {utc}
        </span>
        <span className="ml-1 hidden font-mono text-[14px] tracking-[0.2em] text-hud-dim md:inline">
          UTC
        </span>
      </div>

      <LegendDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </header>
  );
}

function Stat({
  label,
  value,
  color = "text-hud-grid",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[13px] tracking-[0.15em] text-hud-dim sm:text-[14px]">
        {label}
      </span>
      <span
        className={`font-mono text-[13px] font-bold tabular-nums sm:text-xs ${color}`}
      >
        {String(value).padStart(3, "0")}
      </span>
    </div>
  );
}

function StreamStatus({ state }: { state: RiskConnectionState }) {
  const label =
    state === "open"
      ? "LIVE"
      : state === "connecting"
        ? "SYNC"
        : state === "reconnecting"
          ? "RECON"
          : "DOWN";
  const colorClass =
    state === "open"
      ? "text-hud-grid"
      : state === "error"
        ? "text-hud-warn"
        : "text-hud-dim";
  const dotClass =
    state === "open"
      ? "bg-hud-grid"
      : state === "error"
        ? "bg-hud-warn animate-status-blink"
        : "bg-hud-dim animate-status-blink";
  return (
    <div className="flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${dotClass}`} />
      <span
        className={`hidden font-mono text-[14px] tracking-[0.16em] ${colorClass} md:inline`}
      >
        {label}
      </span>
    </div>
  );
}
