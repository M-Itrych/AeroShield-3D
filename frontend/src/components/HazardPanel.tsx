import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HazardPolygon } from "@/types/domain";

interface HazardPanelProps {
  sigmets: HazardPolygon[];
  isLoading?: boolean;
  onSelect?: (sigmetId: string) => void;
}

export function HazardPanel({
  sigmets,
  isLoading,
  onSelect,
}: HazardPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute right-0 top-9 z-30 flex h-12 w-8 items-center justify-center border-l border-b border-hud-warn/20 bg-hud-charcoal/95 backdrop-blur-md"
        aria-label="Expand hazards panel"
      >
        <ChevronLeft className="size-4 text-hud-warn" />
      </button>
    );
  }

  return (
    <aside className="absolute right-0 top-9 z-30 flex h-[calc(100%-2.25rem)] w-64 flex-col border-l border-hud-warn/20 bg-hud-charcoal/95 backdrop-blur-md sm:w-72">
      <div className="flex items-center justify-between border-b border-hud-warn/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 animate-status-blink rounded-full bg-hud-warn" />
          <h2 className="font-mono text-[10px] font-bold tracking-[0.18em] text-hud-warn">
            ACTIVE SIGMETS
          </h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-hud-dim transition-colors hover:text-hud-warn"
          aria-label="Collapse panel"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {isLoading && (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {!isLoading && sigmets.length === 0 && (
            <div className="p-4 text-center font-mono text-[10px] tracking-wider text-hud-dim">
              NO ACTIVE HAZARDS
            </div>
          )}
          {sigmets.map((sig) => (
            <button
              key={sig.sigmet_id}
              onClick={() => onSelect?.(sig.sigmet_id)}
              className="border-b border-hud-warn/10 px-3 py-2 text-left transition-colors hover:bg-hud-warn/10"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="border border-hud-warn/60 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-hud-warn">
                  {sig.hazard_type}
                </span>
                <span className="font-mono text-[9px] text-hud-dim">
                  {sig.sigmet_id}
                </span>
              </div>
              <div className="flex gap-2 font-mono text-[10px] text-hud-dim">
                {sig.min_ft && <span>FL{Math.round(sig.min_ft / 100)}</span>}
                {sig.max_ft && <span>- FL{Math.round(sig.max_ft / 100)}</span>}
                <span>{sig.points.length}pts</span>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
