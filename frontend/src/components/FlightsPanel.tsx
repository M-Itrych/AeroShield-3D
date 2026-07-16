import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { FlightVector, RiskAssessment } from "@/types/domain";

interface FlightsPanelProps {
  flights: FlightVector[];
  risks?: RiskAssessment[];
  isLoading?: boolean;
  onSelect?: (icao24: string) => void;
}

function getRisk(
  icao24: string,
  risks?: RiskAssessment[],
): RiskAssessment | undefined {
  return risks?.find((r) => r.flight === icao24);
}

function riskVariant(
  risk?: RiskAssessment,
): "destructive" | "secondary" | "default" {
  if (!risk || risk.risk === "NONE") return "default";
  if (risk.risk === "HIGH") return "destructive";
  return "secondary";
}

export function FlightsPanel({
  flights,
  risks,
  isLoading,
  onSelect,
}: FlightsPanelProps) {
  return (
    <aside className="absolute left-0 top-9 z-30 flex h-[calc(100%-2.25rem)] w-72 flex-col border-r border-cyan-500/15 bg-black/60 backdrop-blur-sm">
      <div className="border-b border-cyan-500/15 px-3 py-2">
        <h2 className="font-mono text-xs font-bold tracking-wider text-radar-grid">
          ACTIVE FLIGHTS
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {isLoading && (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {!isLoading && flights.length === 0 && (
            <div className="p-4 text-center font-mono text-xs text-muted-foreground">
              No flight data
            </div>
          )}
          {flights.map((f) => {
            const risk = getRisk(f.icao24, risks);
            const isHigh = risk?.risk === "HIGH";
            return (
              <button
                key={f.icao24}
                onClick={() => onSelect?.(f.icao24)}
                className={`flex items-center justify-between border-b border-cyan-500/5 px-3 py-1.5 text-left transition-colors hover:bg-cyan-500/5 ${
                  isHigh ? "bg-radar-hazard/5" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs font-medium text-foreground">
                    {f.callsign?.trim() || f.icao24}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {f.origin_country}
                    {f.baro_altitude
                      ? ` - ${Math.round(f.baro_altitude * 3.28)}ft`
                      : ""}
                  </span>
                </div>
                <Badge
                  variant={riskVariant(risk)}
                  className="font-mono text-[9px]"
                >
                  {risk?.risk ?? "NONE"}
                </Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
