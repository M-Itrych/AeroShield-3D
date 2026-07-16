import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface HudBarProps {
  flightCount: number;
  sigmetCount: number;
  highRiskCount?: number;
}

export function HudBar({ flightCount, sigmetCount, highRiskCount }: HudBarProps) {
  const [utc, setUtc] = useState("");

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      const s = String(d.getUTCSeconds()).padStart(2, "0");
      setUtc(`${h}:${m}:${s} UTC`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-cyan-500/15 bg-black/60 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-2 animate-status-blink rounded-full bg-radar-grid" />
          <span className="font-mono text-sm font-bold tracking-wider text-radar-grid">
            AEROSHIELD 3D
          </span>
        </div>
        <span className="text-xs text-muted-foreground">|</span>
        <span className="font-mono text-xs text-muted-foreground">
          Real-Time Aviation Hazard & Routing Analyzer
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Stat label="FLIGHTS" value={flightCount} />
        <Stat label="SIGMETS" value={sigmetCount} color="text-radar-hazard" />
        {highRiskCount !== undefined && highRiskCount > 0 && (
          <Badge variant="destructive" className="font-mono">
            {highRiskCount} HIGH RISK
          </Badge>
        )}
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {utc}
        </span>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  color = "text-radar-grid",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-bold tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}
