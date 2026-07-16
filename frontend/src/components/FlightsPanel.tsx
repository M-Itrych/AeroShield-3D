import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState, type Ref } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FlightVector, FlightRoute, RiskAssessment } from "@/types/domain";

interface FlightsPanelProps {
  flights: FlightVector[];
  risks?: RiskAssessment[];
  isLoading?: boolean;
  onSelect?: (icao24: string) => void;
  selectedId?: string | null;
  riskFilter?: string;
  onRiskFilterChange?: (value: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  followMode?: boolean;
  onFollowModeChange?: (value: boolean) => void;
  selectedFlight?: FlightVector | null;
  route?: FlightRoute | null;
  searchInputRef?: Ref<HTMLInputElement>;
}

const RISK_FILTERS = ["ALL", "HIGH", "MED", "NONE"] as const;

function isHigh(risk?: RiskAssessment): boolean {
  return risk?.risk === "HIGH";
}

function isWarn(risk?: RiskAssessment): boolean {
  return risk?.risk === "HIGH" || risk?.risk === "MEDIUM";
}

export function FlightsPanel({
  flights,
  risks,
  isLoading,
  onSelect,
  selectedId,
  riskFilter = "ALL",
  onRiskFilterChange,
  search = "",
  onSearchChange,
  followMode = false,
  onFollowModeChange,
  selectedFlight,
  route,
  searchInputRef,
}: FlightsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const riskMap = useRef(new Map<string, RiskAssessment>());
  riskMap.current = new Map(risks?.map((r) => [r.flight, r]));

  const virtualizer = useVirtualizer({
    count: flights.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 6,
  });

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute left-0 top-9 z-30 flex h-12 w-8 items-center justify-center border-r border-b border-hud-border bg-hud-charcoal/95 backdrop-blur-md"
        aria-label="Expand flights panel"
      >
        <ChevronRight className="size-4 text-hud-grid" />
      </button>
    );
  }

  return (
    <aside className="absolute left-0 top-9 z-30 flex h-[calc(100%-2.25rem)] w-64 flex-col border-r border-hud-border bg-hud-charcoal/95 backdrop-blur-md sm:w-72">
      <div className="flex items-center justify-between border-b border-hud-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 animate-status-blink rounded-full bg-hud-grid" />
          <h2 className="font-mono text-[12px] font-bold tracking-[0.18em] text-hud-grid">
            ACTIVE TRACKS
          </h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-hud-dim transition-colors hover:text-hud-grid"
          aria-label="Collapse panel"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 border-b border-hud-border px-3 py-2">
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="QUERY CALLSIGN / ICAO..."
          className="w-full border border-hud-border bg-hud-charcoal/60 px-2 py-1.5 font-mono text-[13px] text-hud-ink placeholder:text-hud-dim placeholder:tracking-wider focus:border-hud-grid focus:outline-none"
        />
        <div className="flex items-center gap-1">
          {RISK_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => onRiskFilterChange?.(r === "MED" ? "MEDIUM" : r)}
              className={`flex-1 border px-1 py-0.5 font-mono text-[11px] tracking-wider transition-colors ${
                (riskFilter === "MEDIUM" ? "MED" : riskFilter) === r
                  ? r === "HIGH"
                    ? "border-hud-warn bg-hud-warn/10 text-hud-warn"
                    : "border-hud-grid bg-hud-grid/10 text-hud-grid"
                  : "border-hud-border text-hud-dim hover:border-hud-grid/40"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {selectedFlight && (
        <div className="flex flex-col gap-1 border-b border-hud-border bg-hud-grid/5 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] font-bold tracking-wider text-hud-ink">
              {selectedFlight.callsign?.trim() || selectedFlight.icao24}
            </span>
            <button
              onClick={() => onFollowModeChange?.(!followMode)}
              className={`border px-2 py-0.5 font-mono text-[11px] tracking-wider transition-colors ${
                followMode
                  ? "border-hud-grid bg-hud-grid/15 text-hud-grid"
                  : "border-hud-border text-hud-dim hover:border-hud-grid/50"
              }`}
            >
              {followMode ? "LOCK-ON" : "TRACK"}
            </button>
          </div>
          <div className="font-mono text-[12px] text-hud-dim">
            {selectedFlight.origin_country}
            {selectedFlight.baro_altitude
              ? ` | ${Math.round(selectedFlight.baro_altitude * 3.28)}ft`
              : ""}
            {selectedFlight.velocity
              ? ` | ${Math.round(selectedFlight.velocity)}m/s`
              : ""}
          </div>
          {route && (route.departure || route.arrival) && (
            <div className="font-mono text-[12px] text-hud-grid">
              {route.departure_airport?.iata ?? route.departure ?? "---"} {"->"}{" "}
              {route.arrival_airport?.iata ?? route.arrival ?? "---"}
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="h-full overflow-auto">
          {isLoading && (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {!isLoading && flights.length === 0 && (
            <div className="p-4 text-center font-mono text-[12px] tracking-wider text-hud-dim">
              NO TRACK DATA
            </div>
          )}
          {!isLoading && flights.length > 0 && (
            <div
              style={{ height: `${virtualizer.getTotalSize()}px` }}
              className="relative w-full"
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const f = flights[vItem.index];
                if (!f) return null;
                const risk = riskMap.current.get(f.icao24);
                const high = isHigh(risk);
                const warn = isWarn(risk);
                const isSelected = selectedId === f.icao24;
                return (
                  <button
                    key={f.icao24}
                    onClick={() => onSelect?.(f.icao24)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vItem.start}px)`,
                    }}
                    className={`flex h-12 items-center justify-between border-b border-hud-border px-3 py-1.5 text-left transition-colors hover:bg-hud-grid/10 ${
                      high ? "bg-hud-warn/10" : ""
                    } ${isSelected ? "bg-hud-grid/15" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span
                        className={`truncate font-mono text-[13px] font-medium ${
                          high ? "text-hud-warn" : "text-hud-ink"
                        }`}
                      >
                        {f.callsign?.trim() || f.icao24}
                      </span>
                      <span className="truncate font-mono text-[12px] text-hud-dim">
                        {f.origin_country}
                        {f.baro_altitude
                          ? ` ${Math.round(f.baro_altitude * 3.28)}ft`
                          : ""}
                      </span>
                    </div>
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[11px] tracking-wider ${
                        high
                          ? "border-hud-warn text-hud-warn"
                          : warn
                            ? "border-hud-warn/50 text-hud-warn/80"
                            : "border-hud-border text-hud-grid/80"
                      }`}
                    >
                      {risk?.risk ?? "NONE"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
